import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { Readable } from 'node:stream';
const tmp = mkdtempSync(resolve(tmpdir(), 'frameforge-test-'));
process.env.FRAMEFORGE_DATA_DIR = tmp;
const S = await import('../server/store.mjs'),
  M = await import('../server/models.mjs'),
  media = await import('../server/media.mjs'),
  G = await import('../server/generation.mjs'),
  E = await import('../server/export.mjs'),
  audio = await import('../shared/audio-role.mjs');
after(() => {
  S.db.close();
  rmSync(tmp, { recursive: true, force: true });
});
let film, other, shot, source, video;
const approve = (f, v) =>
  S.reviewVersion(f.id, v.id, {
    checks: Object.fromEntries(S.CHECKS[v.kind].map((k) => [k, 'pass'])),
    status: 'approved',
  });
void test('separate films never share scenes, shots, or references', () => {
  film = S.createFilm({ title: 'Test film' });
  other = S.createFilm({ title: 'Other film' });
  film = S.addScene(film.id, { title: 'EXT. COAST — NIGHT' });
  film = S.addShot(film.id, {
    title: 'Wide',
    sceneId: film.scenes[0].id,
    duration: 1,
  });
  shot = film.shots[0];
  assert.equal(S.getFilm(other.id).shots.length, 0);
  assert.throws(
    () => S.addShot(other.id, { title: 'Invalid', sceneId: film.scenes[0].id }),
    /not found/,
  );
});
void test('audio cut mapping preserves dialogue/music/sfx roles and gains', () => {
  assert.deepEqual(audio.audioTrackSettings({ audioRole: 'dialogue' }), {
    role: 'dialogue',
    gain: 1,
  });
  assert.deepEqual(audio.audioTrackSettings({ audioRole: 'music' }), {
    role: 'music',
    gain: 0.25,
  });
  assert.deepEqual(audio.audioTrackSettings({ audioRole: 'sfx' }), {
    role: 'sfx',
    gain: 1,
  });
  assert.deepEqual(audio.audioTrackSettings({}), { role: 'sfx', gain: 1 });
});
void test('shot reorder rejects missing and duplicate ids without changing state', () => {
  const revision = S.getFilm(film.id).revision;
  assert.throws(() => S.reorder(film.id, []), /every shot/);
  assert.equal(S.getFilm(film.id).revision, revision);
});
void test('source media is copied, probed, and content-hashed', async () => {
  const p = resolve(tmp, 'frame.png');
  await media.run('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-f',
    'lavfi',
    '-i',
    'color=c=black:s=160x90',
    '-frames:v',
    '1',
    p,
  ]);
  film = await media.importAsset(
    film.id,
    shot.id,
    Readable.from(readFileSync(p)),
    'source.png',
  );
  source = film.versions.at(-1);
  assert.equal(source.kind, 'image');
  assert.equal(source.width, 160);
  assert.equal(source.sha256.length, 64);
  assert.ok(source.localPath);
  assert.notEqual(media.absolute(source.localPath), p);
  assert.equal(source.source, 'import');
});
void test('approval requires explicit complete checks; approval never selects automatically', () => {
  assert.throws(
    () => S.reviewVersion(film.id, source.id, { status: 'approved' }),
    /Complete all/,
  );
  film = approve(film, source);
  assert.equal(film.versions.at(-1).status, 'approved');
  assert.equal(film.shots[0].selectedVersionId, null);
  film = S.selectVersion(film.id, shot.id, source.id);
  assert.equal(film.shots[0].selectedVersionId, source.id);
});
void test('rejecting selected media removes it from the cut without deleting it', () => {
  film = S.reviewVersion(film.id, source.id, { status: 'rejected' });
  assert.equal(film.shots[0].selectedVersionId, null);
  assert.throws(
    () => S.selectVersion(film.id, shot.id, source.id),
    /non-rejected/,
  );
  assert.equal(film.versions.length, 1);
  film = S.reviewVersion(film.id, source.id, { status: 'review' });
});
void test('bible revision invalidates approvals and partial recheck cannot reuse old passes', () => {
  film = approve(film, source);
  film = S.saveEntity(film.id, {
    name: 'Lead',
    type: 'character',
    description: 'Age 32, brown eyes',
    continuity: 'Blue coat',
    locked: true,
  });
  assert.equal(S.qcComplete(film, film.versions[0]), false);
  film = S.reviewVersion(film.id, source.id, {
    checks: { [S.CHECKS.image[0]]: 'pass' },
  });
  assert.equal(Object.keys(film.versions[0].checks).length, 1);
  assert.throws(
    () => S.reviewVersion(film.id, source.id, { status: 'approved' }),
    /Complete all/,
  );
});
void test('correction notes block approval; resolution preserves original note and input', () => {
  film = approve(film, source);
  const before = JSON.stringify(film.versions[0].input);
  film = S.reviewVersion(film.id, source.id, {
    note: 'Correct the coat',
    time: 0,
    x: 0.25,
    y: 0.5,
  });
  assert.equal(film.versions[0].status, 'review');
  assert.throws(
    () => S.reviewVersion(film.id, source.id, { status: 'approved' }),
    /Complete all/,
  );
  film = S.reviewVersion(film.id, source.id, {
    resolveNote: film.versions[0].notes[0].id,
    status: 'approved',
  });
  assert.equal(film.versions[0].notes[0].text, 'Correct the coat');
  assert.equal(JSON.stringify(film.versions[0].input), before);
});
void test('visual requests snapshot canonical identity and enforce required reference inputs', () => {
  film = S.editShot(film.id, shot.id, {
    entityIds: [film.entities.find(e=>e.name==='Lead').id],
    prompt: 'A quiet moment',
  });
  const p = G.preview(film.id, {
    shotId: shot.id,
    model: 'fal-ai/flux-2/edit',
    prompt: 'A quiet moment',
    references: [source.id],
    options: {},
  });
  assert.match(p.input.prompt, /Age 32/);
  assert.match(p.input.prompt, /Blue coat/);
  assert.equal(p.input.image_urls[0], `asset:${source.id}`);
  assert.throws(
    () =>
      G.preview(film.id, {
        shotId: shot.id,
        model: 'fal-ai/flux-2/edit',
        prompt: 'X',
        references: [],
        options: {},
      }),
    /one to four/,
  );
  assert.throws(
    () =>
      G.preview(other.id, {
        shotId: shot.id,
        model: 'fal-ai/flux-2',
        prompt: 'X',
      }),
    /not found/,
  );
});
void test('FAL adapters map speech, native sound, music and lipsync with verified field names', () => {
  const kling = M.getModel('fal-ai/kling-video/v2.6/pro/image-to-video');
  const input = M.buildInput(kling, 'walk', {
    duration: 5,
    start_image_url: 'asset:test',
    generate_audio: true,
  });
  assert.equal(input.generate_audio, true);
  assert.equal(input.start_image_url, 'asset:test');
  assert.equal(M.estimate(kling, input), 0.7);
  assert.throws(() => M.buildInput(kling, 'walk', { duration: 7 }), /5 or 10/);
  const tts = M.buildInput(
    M.getModel('fal-ai/elevenlabs/tts/eleven-v3'),
    'Hello',
    { voice: 'Rachel' },
  );
  assert.equal(tts.text, 'Hello');
  assert.equal(tts.prompt, undefined);
  const sync = M.buildInput(M.getModel('fal-ai/sync-lipsync/v2'), 'unused', {
    video_url: 'asset:v',
    audio_url: 'asset:a',
  });
  assert.equal(sync.sync_mode, 'silence');
});
void test('generation never submits without a key and explicit cost confirmation', () => {
  const key = process.env.FAL_KEY;
  delete process.env.FAL_KEY;
  assert.throws(() => G.generate(film.id, {}), /API key/);
  if (key) process.env.FAL_KEY = key;
  assert.equal(S.getFilm(film.id).versions.length, 1);
});
void test('actual billing is recorded separately from original generation metadata', () => {
  film = S.recordCost(film.id, source.id, { actualCost: 0.42 });
  assert.equal(film.versions[0].actualCost, 0.42);
  assert.ok(
    S.events(film.id).some((e) => e.action === 'version.cost_recorded'),
  );
});
void test('working cut renders real MP4 and preserves a production snapshot', async () => {
  film = S.selectVersion(film.id, shot.id, source.id);
  const job = E.startExport(film.id, { final: false });
  let out;
  for (let i = 0; i < 100; i++) {
    out = E.listExports(film.id).find((e) => e.id === job.id);
    if (out.status !== 'rendering') break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.equal(out.status, 'complete', out.error);
  const result = await media.probe(resolve(E.EXPORTS, job.id, 'film.mp4'));
  assert.ok(result.streams.some((s) => s.codec_type === 'video'));
  assert.ok(result.streams.some((s) => s.codec_type === 'audio'));
  assert.ok(Math.abs(Number(result.format.duration) - 1) < 0.15);
  const snapshot = JSON.parse(
    readFileSync(resolve(E.EXPORTS, job.id, 'production.json')),
  );
  assert.equal(snapshot.film.shots[0].selectedVersionId, source.id);
  assert.throws(
    () => E.startExport(film.id, { final: true }),
    /approved.*video/,
  );
});
void test('replacement preserves trim, order, and earlier versions; final gate detects short source', async () => {
  const p = resolve(tmp, 'clip.mp4');
  await media.run('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-f',
    'lavfi',
    '-i',
    'color=c=black:s=160x90:d=1',
    '-c:v',
    'libx264',
    p,
  ]);
  film = await media.importAsset(
    film.id,
    shot.id,
    Readable.from(readFileSync(p)),
    'clip.mp4',
  );
  video = film.versions.at(-1);
  assert.equal(video.kind, 'video');
  film = approve(film, video);
  const oldShot = structuredClone(film.shots[0]);
  film = S.selectVersion(film.id, shot.id, video.id);
  assert.equal(film.versions.length, 2);
  assert.equal(film.shots[0].duration, oldShot.duration);
  assert.equal(film.shots[0].order, oldShot.order);
  film = S.editShot(film.id, shot.id, { duration: 2 });
  assert.throws(() => E.startExport(film.id, { final: true }), /exceeds/);
  film = S.editShot(film.id, shot.id, { duration: 1 });
});
void test('muting a shot original audio keeps the video but excludes its sound from export', async () => {
  let film = S.createFilm({ title: 'Muted audio test' });
  film = S.addScene(film.id, { title: 'Studio' });
  film = S.addShot(film.id, { title: 'Muted shot', sceneId: film.scenes[0].id, duration: 1 });
  const shot = film.shots[0];
  const p = resolve(tmp, 'native-audio.mp4');
  await media.run('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-f',
    'lavfi',
    '-i',
    'color=c=black:s=160x90:d=1',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=1000:sample_rate=48000:duration=1',
    '-shortest',
    '-c:v',
    'libx264',
    '-c:a',
    'aac',
    p,
  ]);
  film = await media.importAsset(
    film.id,
    shot.id,
    Readable.from(readFileSync(p)),
    'native-audio.mp4',
  );
  const native = film.versions.at(-1);
  assert.equal(native.hasAudio, true);
  film = approve(film, native);
  film = S.selectVersion(film.id, shot.id, native.id);
  film = S.editShot(film.id, shot.id, { originalAudioMuted: true });
  assert.equal(film.shots[0].originalAudioMuted, true);
  const job = E.startExport(film.id, { final: false });
  let out;
  for (let i = 0; i < 100; i++) {
    out = E.listExports(film.id).find((e) => e.id === job.id);
    if (out.status !== 'rendering') break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.equal(out.status, 'complete', out.error);
  const wav = resolve(tmp, 'muted-export.pcm');
  await media.run('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-i',
    resolve(E.EXPORTS, job.id, 'film.mp4'),
    '-vn',
    '-ac',
    '1',
    '-ar',
    '8000',
    '-f',
    's16le',
    wav,
  ]);
  const samples = readFileSync(wav);
  let peak = 0;
  for (let i = 0; i + 1 < samples.length; i += 2)
    peak = Math.max(peak, Math.abs(samples.readInt16LE(i)));
  assert.ok(peak < 64, `muted export retained audible samples (peak ${peak})`);
});
void test('production archive includes immutable prompts, decisions, source hashes, and version history', () => {
  const archive = E.manifest(film.id);
  assert.equal(archive.schemaVersion, 1);
  assert.equal(archive.film.versions.length, 2);
  assert.ok(archive.events.length > 10);
  assert.ok(archive.events.some((e) => e.action === 'cut.version_selected'));
  assert.ok(archive.events.some((e) => e.action === 'entity.created'));
});
void test('queue reservation is idempotent and stores the exact provider request', async () => {
  const oldKey = process.env.FAL_KEY,
    oldFactory = G.providerFactories.fal;
  process.env.FAL_KEY = 'test-not-a-real-key';
  let submissions = 0;
  G.providerFactories.fal = () => ({
    storage: { upload: async () => 'https://fal.media/reference.png' },
    queue: {
      submit: async (_model, { input }) => {
        submissions++;
        assert.match(input.prompt, /Blue coat/);
        return { request_id: 'mock-request-id-12345' };
      },
      status: async () => ({ status: 'IN_PROGRESS' }),
    },
  });
  try {
    const request = {
      shotId: shot.id,
      model: 'fal-ai/flux-2',
      prompt: 'Test request',
      references: [],
      options: {},
      confirmCost: true,
      acceptUnknownCost: true,
      expectedRevision: S.getFilm(film.id).revision,
      idempotencyKey: 'test-reservation',
    };
    G.generate(film.id, request);
    G.generate(film.id, request);
    for (let i = 0; i < 30; i++) {
      if (S.getFilm(film.id).versions.at(-1).requestId) break;
      await new Promise((r) => setTimeout(r, 10));
    }
    const v = S.getFilm(film.id).versions.at(-1);
    assert.equal(submissions, 1);
    assert.equal(v.requestId, 'mock-request-id-12345');
    assert.equal(v.status, 'queued');
    assert.ok(v.context.entities.length);
    assert.equal(v.input.prompt, v.providerInput.prompt);
    await G.refreshJob(film.id, v.id);
    assert.equal(S.getFilm(film.id).versions.at(-1).status, 'running');
  } finally {
    G.providerFactories.fal = oldFactory;
    if (oldKey) process.env.FAL_KEY = oldKey;
    else delete process.env.FAL_KEY;
  }
});
void test('uncertain submission is preserved for reconciliation and never retried automatically', async () => {
  const oldKey = process.env.FAL_KEY,
    oldFactory = G.providerFactories.fal;
  process.env.FAL_KEY = 'test-not-a-real-key';
  let submissions = 0;
  G.providerFactories.fal = () => ({
    queue: {
      submit: async () => {
        submissions++;
        throw Error('network interrupted');
      },
    },
  });
  try {
    G.generate(film.id, {
      shotId: shot.id,
      model: 'fal-ai/flux-2',
      prompt: 'Test uncertainty',
      references: [],
      options: {},
      confirmCost: true,
      acceptUnknownCost: true,
      expectedRevision: S.getFilm(film.id).revision,
      idempotencyKey: 'unknown-reservation',
    });
    for (let i = 0; i < 30; i++) {
      if (S.getFilm(film.id).versions.at(-1).status === 'submission_unknown')
        break;
      await new Promise((r) => setTimeout(r, 10));
    }
    const v = S.getFilm(film.id).versions.at(-1);
    assert.equal(v.status, 'submission_unknown');
    assert.equal(submissions, 1);
    const recovered = G.reconcile(film.id, v.id, {
      requestId: 'recovered-request-123',
    });
    assert.equal(recovered.versions.at(-1).status, 'queued');
    assert.equal(submissions, 1);
  } finally {
    G.providerFactories.fal = oldFactory;
    if (oldKey) process.env.FAL_KEY = oldKey;
    else delete process.env.FAL_KEY;
  }
});

void test('final delivery requires approved audio and renders the active sound mix', async () => {
  const p = resolve(tmp, 'voice.wav');
  await media.run('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=440:duration=1',
    p,
  ]);
  film = await media.importAsset(
    film.id,
    null,
    Readable.from(readFileSync(p)),
    'voice.wav',
  );
  const audio = film.versions.at(-1);
  assert.equal(audio.kind, 'audio');
  film = S.addTrack(film.id, {
    versionId: audio.id,
    role: 'dialogue',
    label: 'Voice',
    start: 0,
    gain: 0.5,
  });
  assert.throws(
    () => E.startExport(film.id, { final: true }),
    /Approve all active audio/,
  );
  film = approve(film, audio);
  const job = E.startExport(film.id, { final: true });
  let result;
  for (let i = 0; i < 100; i++) {
    result = E.listExports(film.id).find((e) => e.id === job.id);
    if (result.status !== 'rendering') break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.equal(result.status, 'complete', result.error);
  const check = await media.run('ffmpeg', [
    '-hide_banner',
    '-i',
    resolve(E.EXPORTS, job.id, 'film.mp4'),
    '-af',
    'volumedetect',
    '-vn',
    '-sn',
    '-dn',
    '-f',
    'null',
    '-',
  ]);
  assert.match(check.stderr, /max_volume: -[0-9.]+ dB/);
  assert.doesNotMatch(check.stderr, /max_volume: -inf/);
});

void test('provider files without extensions receive browser-readable media filenames', async () => {
  const p = resolve(tmp, 'frame.png');
  const asset = await media.storeStream(Readable.from(readFileSync(p)), 'bin');
  assert.match(asset.localPath, /\.png$/);
  assert.equal(asset.kind, 'image');
  assert.ok(readFileSync(media.absolute(asset.localPath)).length > 0);
});

void test('Seedance maps start/end references and prices resolution without inheriting Kling fields', () => {
  const m = M.getModel('bytedance/seedance-2.5/image-to-video');
  const input = M.buildInput(m, 'A hero releases a shockwave', {
    image_url: 'asset:start',
    end_image_url: 'asset:end',
    duration: '15',
    resolution: '720p',
    generate_audio: true,
    negative_prompt: 'unused',
  });
  assert.equal(input.image_url, 'asset:start');
  assert.equal(input.end_image_url, 'asset:end');
  assert.equal(input.aspect_ratio, 'auto');
  assert.equal(input.start_image_url, undefined);
  assert.equal(input.negative_prompt, undefined);
  assert.equal(M.estimate(m, input), 7.095);
  assert.equal(M.estimate(m, { ...input, generate_audio: false }), 7.095);
  assert.equal(M.estimate(m, { ...input, resolution: '1080p' }), 17.46);
  assert.throws(() => M.buildInput(m, 'x', { duration: '31' }), /requires/);
  assert.throws(
    () => M.buildInput(m, 'x', { image_url: 'asset:x', resolution: '4k' }),
    /resolution/,
  );
  assert.throws(() => M.buildInput(m, 'x'), /image url is required/);
  const t = M.buildInput(
    M.getModel('bytedance/seedance-2.5/text-to-video'),
    'x',
    { duration: '4', aspect_ratio: '2.39:1' },
  );
  assert.equal(t.aspect_ratio, '21:9');
  assert.equal(t.generate_audio, true);
});
void test('Seedance preparation archives local image references and rejects ignored references', () => {
  const b = {
    shotId: shot.id,
    model: 'bytedance/seedance-2.5/image-to-video',
    prompt: 'Animate',
    references: [source.id],
    options: { duration: '5', resolution: '720p' },
  };
  const result = G.preview(film.id, b);
  assert.equal(result.input.image_url, 'asset:' + source.id);
  assert.equal(result.estimate, 2.365);
  assert.throws(
    () =>
      G.preview(film.id, {
        ...b,
        model: 'bytedance/seedance-2.5/text-to-video',
      }),
    /Too many/,
  );
});
void test('extracting a continuity frame retains its parent and time without selecting it', async () => {
  const before = S.getFilm(film.id);
  const parent = before.versions.find((v) => v.kind === 'video' && v.localPath);
  const after = await media.extractFrame(film.id, parent.id, { at: 'end' });
  const frame = after.versions.at(-1);
  assert.equal(frame.kind, 'image');
  assert.equal(frame.status, 'review');
  assert.equal(frame.parentVersionId, parent.id);
  assert.deepEqual(frame.references, [parent.id]);
  assert.equal(frame.input.time, Math.max(0, parent.duration - 1 / (parent.fps || 24)));
  assert.deepEqual(
    after.shots.map((s) => s.selectedVersionId),
    before.shots.map((s) => s.selectedVersionId),
  );
  await assert.rejects(
    () => media.extractFrame(other.id, parent.id, { at: 'end' }),
    /not found/,
  );
  await assert.rejects(
    () => media.extractFrame(film.id, parent.id, { time: -1 }),
    /Frame time/,
  );
});

void test('provider validation errors show the actionable reason without echoing provider input', () => {
  const error = {
    message: 'Unprocessable Entity',
    body: {
      detail: [
        {
          msg: 'Output rejected. Please revise your prompt.',
          input: { private: 'secret' },
          loc: ['body', 'generated_video'],
        },
      ],
    },
  };
  assert.equal(
    G.providerError(error),
    'Output rejected. Please revise your prompt.',
  );
  assert.equal(
    G.providerError(new Error('Network unavailable')),
    'Network unavailable',
  );
});
void test('Seedance 2.0 Mini supports text and reference endpoints', () => {
  const mini = M.getModel('bytedance/seedance-2.0/mini/text-to-video');
  assert.equal(mini.pricing, null);
  const text = M.buildInput(mini, 'fast test', {
    duration: '5',
    resolution: '720p',
    aspect_ratio: '16:9',
    generate_audio: true,
  });
  assert.equal(text.generate_audio, true);
  const ref = M.getModel('bytedance/seedance-2.0/mini/reference-to-video');
  const input = M.buildInput(ref, 'continue this shot', {
    duration: '5',
    resolution: '480p',
    aspect_ratio: '16:9',
    generate_audio: true,
    image_urls: ['asset:1', 'asset:2'],
  });
  assert.equal(input.image_urls.length, 2);
  assert.throws(
    () =>
      M.buildInput(ref, 'x', {
        duration: '5',
        image_urls: Array.from({ length: 10 }, (_, i) => `asset:${i}`),
      }),
    /image references/i,
  );
});

void test('archiving is reversible and never deletes provenance or active dependencies', () => {
  let f = S.createFilm({title:'Archive regression'});
  f = S.mutate(f.id, 'fixture', f => {
    f.versions.push({id:'failed-version', status:'failed',kind:'video',references:[],prompt:'original',input:{seed:42}});
    f.versions.push({id:'active-version', status:'running',kind:'video',references:[]});
  });
  const original = structuredClone(f.versions[0]);
  assert.throws(()=>S.deleteVersion(f.id,'active-version'), /פעילה/);
  f = S.deleteVersion(f.id,'failed-version').film;
  assert.equal(f.versions.some(v=>v.id==='failed-version'),false);
  assert.equal(f.archivedVersions[0].input.seed,42);
  f = S.restoreVersion(f.id,'failed-version');
  assert.deepEqual(f.versions.find(v=>v.id==='failed-version'),original);
  S.mutate(f.id,'fixture', f=>f.versions.push({id:'child',references:['failed-version'],status:'review'}));
  assert.throws(()=>S.deleteVersion(f.id,'failed-version'), /בשימוש/);
});
void test('continuation extracts the trimmed cut endpoint into the next shot without selecting or approving', async () => {
  let f = S.getFilm(film.id);
  const parent = f.versions.find(v=>v.kind==='video'&&v.localPath);
  f = S.addShot(f.id,{title:'Continuation',duration:0.5,sceneId:f.scenes[0].id});
  const target=f.shots.at(-1);
  S.mutate(f.id,'fixture', f=>{
    const ordered=[...f.shots].sort((a,b)=>a.order-b.order);
    const prev=ordered[ordered.length-2];
    parent.shotId=prev.id;
    f.versions.find(v=>v.id===parent.id).shotId=prev.id;
    prev.selectedVersionId=parent.id; prev.trimIn=0; prev.duration=0.5;
  });
  f=await media.extractFrame(f.id,parent.id,{at:'end',targetShotId:target.id});
  const frame=f.versions.at(-1);
  assert.equal(frame.shotId,target.id);
  assert.equal(frame.workflowTask,'keyframe');
  assert.equal(frame.status,'review');
  assert.ok(frame.input.time < 0.5);
  assert.equal(f.shots.find(s=>s.id===target.id).connection.frameVersionId,frame.id);
  assert.ok(!f.shots.find(s=>s.id===target.id).selectedVersionId);
  assert.equal(f.versions.find(v=>v.id===parent.id).localPath,parent.localPath);
});

void test('cut undo/redo preserves generated jobs and unrelated changes across reloads', () => {
  let f=S.createFilm({title:'Cut history'});
  f=S.addScene(f.id,{title:'Scene'});
  f=S.addShot(f.id,{title:'First',sceneId:f.scenes[0].id,duration:5});
  const sid=f.shots[0].id;
  S.editShot(f.id,sid,{duration:3});
  S.mutate(f.id,'job.completed', f=>f.versions.push({id:'independent',status:'review'}));
  f=S.travelCutHistory(f.id,'undo');
  assert.equal(f.shots[0].duration,5);
  assert.equal(f.versions.at(-1).id,'independent');
  f=S.travelCutHistory(f.id,'redo');
  assert.equal(f.shots[0].duration,3);
  S.travelCutHistory(f.id,'undo');
  f=S.editShot(f.id,sid,{trimIn:1});
  assert.equal(f.cutHistory.future.length,0);
  S.mutate(f.id,'concurrent', f=>{f.shots[0].trimIn=2;});
  assert.throws(()=>S.travelCutHistory(f.id,'undo'), /השתנתה/);
  assert.equal(S.getFilm(f.id).shots[0].trimIn,2);
});

void test('new shots prepare one shared location; explicit unlink survives reads', () => {
  let f=S.createFilm({title:'Shot locations'});
  f=S.addScene(f.id,{title:'INT/EXT. Courtyard — DAY'});
  const scene=f.scenes[0];
  f=S.addShot(f.id,{title:'First',sceneId:scene.id});
  f=S.addShot(f.id,{title:'Second',sceneId:scene.id});
  assert.equal(f.entities.length,1);
  assert.equal(f.entities[0].name,'Courtyard');
  assert.deepEqual(f.shots[0].entityIds,f.shots[1].entityIds);
  const shot=f.shots[0], prior=shot.continuityRevision;
  f=S.editShot(f.id,shot.id,{entityIds:[]});
  assert.ok(f.shots[0].continuityRevision>prior);
  assert.deepEqual(S.getFilm(f.id).shots[0].entityIds,[]);
  f=S.prepareShotLocations(f.id,shot.id);
  assert.equal(f.entities.length,1);
  assert.equal(f.shots[0].entityIds[0],f.entities[0].id);
  const revision=f.shots[0].continuityRevision;
  f=S.prepareShotLocations(f.id,shot.id);
  assert.equal(f.shots[0].continuityRevision,revision);
});
void test('revision preview rejects a wrong media type or a different asset before submission', () => {
  let f=S.createFilm({title:'Revision routing'});
  f=S.saveEntity(f.id,{name:'Actor',type:'character'});
  const actor=f.entities[0];
  f=S.saveEntity(f.id,{name:'Place',type:'location'});
  const place=f.entities[1];
  S.mutate(f.id,'fixture', f=>f.versions.push({id:'actor-reference',entityId:actor.id,shotId:null,kind:'image',status:'failed'}));
  assert.throws(()=>G.preview(f.id,{entityId:place.id,parentVersionId:'actor-reference',model:'fal-ai/flux-2',prompt:'Reference',options:{},references:[]}),/belong to this asset/);
  f=S.addShot(f.id,{title:'Shot'});
  const sid=f.shots[0].id;
  S.mutate(f.id,'fixture', f=>f.versions.push({id:'failed-video',shotId:sid,kind:'video',status:'failed'}));
  assert.throws(()=>G.preview(f.id,{shotId:sid,parentVersionId:'failed-video',model:'fal-ai/flux-2',prompt:'Retry',options:{},references:[]}),/keep its media type/);
});

void test('asset view planning requires an approved same-asset reference and a reference-capable model', () => {
  let f=S.createFilm({title:'Identity angles'});
  f=S.editFilm(f.id,{style:'Hero falling into an exploding city'});
  f=S.saveEntity(f.id,{name:'Reference actor',type:'character',description:'40 years old, blue pajamas'});
  const entity=f.entities[0];
  f=S.mutate(f.id,'fixture', f=>f.versions.push({id:'master',entityId:entity.id,shotId:null,kind:'image',localPath:source.localPath,status:'approved',reviewBibleRevision:f.bibleRevision,checks:Object.fromEntries(S.CHECKS.image.map(k=>[k,'pass'])),notes:[]}));
  const input={entityId:entity.id,assetView:'profile',assetBaseVersionId:'master',model:'fal-ai/flux-2/edit',prompt:'Left profile of the same subject',references:['master'],options:{}};
  const preview=G.preview(f.id,input);
  assert.deepEqual(preview.input.image_urls,['asset:master']);
  assert.doesNotMatch(preview.input.prompt,/exploding city/);
  assert.throws(()=>G.preview(f.id,{...input,model:'fal-ai/flux-2'}),/image-reference model/);
  assert.throws(()=>G.preview(f.id,{...input,references:[]}),/Approve and select/);
  assert.throws(()=>G.preview(f.id,{...input,assetView:'reverse'}),/asset type/);
  S.reviewVersion(f.id,'master',{status:'review'});
  assert.throws(()=>G.preview(f.id,input),/Approve and select/);
});

void test('image preparation preserves film portrait ratio and forces entity references square', () => {
  let portrait = S.createFilm({ title: 'Portrait sizing' });
  portrait = S.addShot(portrait.id, { title: 'Portrait shot' });
  portrait = S.editFilm(portrait.id, { aspectRatio: '9:16' });
  const shotPreview = G.preview(portrait.id, {
    shotId: portrait.shots[0].id,
    model: 'fal-ai/flux-2',
    prompt: 'A person walking through rain',
    options: {},
  });
  assert.equal(shotPreview.input.image_size, 'portrait_16_9');

  portrait = S.saveEntity(portrait.id, {
    name: 'Raincoat subject',
    type: 'character',
    description: 'A person in a yellow raincoat',
  });
  S.mutate(portrait.id, 'test.kontext_fixture', film => {
    film.versions.push({ id: 'kontext-source', kind: 'image', status: 'review', localPath: source.localPath });
  });
  const entityPreview = G.preview(portrait.id, {
    entityId: portrait.entities[0].id,
    model: 'fal-ai/qwen-image',
    prompt: 'A clean identity reference portrait',
    options: {},
  });
  assert.equal(entityPreview.input.image_size, 'square_hd');
  const kontextPreview = G.preview(portrait.id, {
    entityId: portrait.entities[0].id,
    model: 'fal-ai/flux-pro/kontext',
    prompt: 'A clean identity reference portrait',
    references: ['kontext-source'],
    options: {},
  });
  assert.equal(kontextPreview.input.aspect_ratio, '1:1');
});

void test('reference preparation maps image, video, and audio assets to plural provider fields', () => {
  let f = S.createFilm({ title: 'Plural references' });
  f = S.addShot(f.id, { title: 'Reference shot' });
  const refs = [
    ['ref-image', 'image'],
    ['ref-video', 'video'],
    ['ref-audio', 'audio'],
  ];
  S.mutate(f.id, 'test.reference_fixture', (film) => {
    for (const [id, kind] of refs)
      film.versions.push({ id, kind, status: 'review', localPath: source.localPath });
  });
  const preview = G.preview(f.id, {
    shotId: f.shots[0].id,
    model: 'bytedance/seedance-2.0/mini/reference-to-video',
    prompt: 'Animate the supplied references',
    references: refs.map(([id]) => id),
    options: { duration: '5', resolution: '480p' },
  });
  assert.deepEqual(preview.input.image_urls, ['asset:ref-image']);
  assert.deepEqual(preview.input.video_urls, ['asset:ref-video']);
  assert.deepEqual(preview.input.audio_urls, ['asset:ref-audio']);
});

void test('TLS provider failures explain the required certificate configuration', () => {
  assert.equal(
    G.providerError({ cause: { code: 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY' } }),
    'Secure provider connection failed: configure NODE_EXTRA_CA_CERTS with the trusted certificate bundle and restart the server.',
  );
  assert.equal(
    G.providerError({ cause: { code: 'SELF_SIGNED_CERT_IN_CHAIN' } }),
    'Secure provider connection failed: configure NODE_EXTRA_CA_CERTS with the trusted certificate bundle and restart the server.',
  );
});

void test('location preparation prefers explicit locations, parses pipe suffixes, and ignores numeric titles', () => {
  let f = S.createFilm({ title: 'Location parser' });
  f = S.saveEntity(f.id, { name: 'Existing set', type: 'location' });
  const explicit = f.entities[0];
  f = S.addScene(f.id, { title: '01 — unrelated metadata' });
  S.mutate(f.id, 'test.explicit_scene_location', film => {
    film.scenes[0].locationEntityId = explicit.id;
  });
  f = S.addShot(f.id, { title: 'Explicit location shot', sceneId: f.scenes[0].id });
  assert.deepEqual(f.shots[0].entityIds, [explicit.id]);

  f = S.addScene(f.id, { title: '01 — דבש הדיווה | סט לבן חם' });
  f = S.addShot(f.id, { title: 'Pipe suffix shot', sceneId: f.scenes[1].id });
  const pipeLocation = f.entities.find(e => e.type === 'location' && e.name === 'סט לבן חם');
  assert.ok(pipeLocation);
  assert.equal(f.shots[1].entityIds.includes(pipeLocation.id), true);

  f = S.addScene(f.id, { title: '02 — arbitrary numbered shot title' });
  f = S.addShot(f.id, { title: 'Numeric title shot', sceneId: f.scenes[2].id });
  assert.deepEqual(f.shots[2].entityIds, []);
  assert.equal(f.entities.some(e => e.type === 'location' && e.name === '02'), false);
});
