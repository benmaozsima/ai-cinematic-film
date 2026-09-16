import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

const dir = mkdtempSync(resolve(tmpdir(), 'frameforge-workflow-'));
process.env.FRAMEFORGE_DATA_DIR = dir;
process.env.FAL_KEY = 'test-key-no-network';
const S = await import('../server/store.mjs');
const G = await import('../server/generation.mjs');
const W = await import('../server/workflow.mjs');
const M = await import('../server/models.mjs');
const { subtitles } = await import('../server/subtitles.mjs');
const results = new Map();
let output,
  submissions = 0;
G.providerFactories.fal = () => ({
  queue: {
    submit: async (endpoint, { input }) => {
      assert.equal(endpoint, 'fal-ai/any-llm');
      assert.ok(input.system_prompt.includes('Hebrew'));
      const request_id = `test-request-${++submissions}`;
      results.set(request_id, output);
      return { request_id };
    },
    status: async () => ({ status: 'COMPLETED' }),
    result: async (_, { requestId }) => ({ data: results.get(requestId) }),
  },
});
after(() => {
  S.db.close();
  rmSync(dir, { recursive: true, force: true });
});
const story = {
  logline: 'אישה חוזרת לבית ילדותה.',
  treatment: 'היא מגיעה, מוצאת מכתב ומתפייסת עם העבר.',
  style: 'Natural light, restrained camera, muted blue.',
};
const screenplay = {
  screenplay: 'פנים. בית — יום. נועה נכנסת. נועה: חזרתי הביתה.',
  entities: [
    {
      type: 'character',
      name: 'נועה',
      description: '32, brown eyes, blue coat',
      continuity: 'Blue coat throughout',
      voice: 'Rachel',
    },
  ],
  scenes: [
    { title: 'פנים. בית — יום', summary: 'נועה נכנסת ואומרת: חזרתי הביתה.' },
  ],
};
const shotPlan = (entityId) => ({
  shots: [
    {
      title: 'נועה בדלת',
      prompt: 'Medium close-up of Noa at the doorway.',
      camera: '50mm, locked off',
      lighting: 'Soft morning light',
      continuity: 'Blue coat',
      duration: 5,
      dialogueLines: [
        { speaker: 'נועה', text: 'חזרתי הביתה.', voice: 'Rachel' },
      ],
      soundEffects: 'Quiet room tone, footsteps, no voices.',
      music: 'Soft instrumental piano, no vocals.',
      onScreenText: 'הבית',
      entityIds: [entityId],
    },
  ],
});
async function makeDraft(filmId, stage, content, extras = {}) {
  output = { output: JSON.stringify(content) };
  const b = {
    stage,
    instructions: 'Create this stage in Hebrew.',
    model: W.WRITERS[0],
    language: 'he',
    ...extras,
  };
  const p = W.planPreview(filmId, b);
  const request = {
    ...b,
    expectedRevision: p.filmRevision,
    idempotencyKey: S.uid(),
    confirmCost: true,
    acceptUnknownCost: true,
  };
  const f = W.createPlan(filmId, request);
  const d = f.workflow.drafts.at(-1);
  await new Promise((r) => setImmediate(r));
  await W.refreshPlan(filmId, d.id);
  return { d: S.getFilm(filmId).workflow.drafts.at(-1), request };
}
const approve = (id, did) =>
  W.approvePlan(id, did, { expectedRevision: S.getFilm(id).revision });
async function developedFilm() {
  const f = S.createFilm({ title: 'Workflow test' });
  const a = await makeDraft(f.id, 'story', story);
  approve(f.id, a.d.id);
  const b = await makeDraft(f.id, 'screenplay', screenplay);
  approve(f.id, b.d.id);
  return S.getFilm(f.id);
}

void test('AI writing is staged, preserves Hebrew, and never creates production records before approval', async () => {
  const f = S.createFilm({ title: 'Hebrew film' });
  assert.throws(
    () =>
      W.planPreview(f.id, {
        stage: 'screenplay',
        model: W.WRITERS[0],
        instructions: 'Write',
      }),
    /Approve the story/,
  );
  const before = submissions;
  const { d, request } = await makeDraft(f.id, 'story', story);
  assert.equal(d.status, 'review');
  assert.equal(S.getFilm(f.id).logline, '');
  assert.equal(d.content.logline, story.logline);
  assert.equal(d.input.model, W.WRITERS[0]);
  assert.equal(d.result.output, JSON.stringify(story));
  W.createPlan(f.id, request);
  assert.equal(
    submissions,
    before + 1,
    'same request token cannot charge twice',
  );
  approve(f.id, d.id);
  assert.equal(S.getFilm(f.id).logline, story.logline);
  assert.equal(S.getFilm(f.id).versions.length, 0);
  assert.equal(
    S.getFilm(f.id).workflow.drafts.length,
    1,
    'approval does not launch next stage',
  );
});

void test('screenplay approval creates independent scenes and bible; shot generation targets just one scene', async () => {
  const f = await developedFilm();
  assert.equal(f.scenes.length, 1);
  assert.equal(f.entities.length, 1);
  assert.equal(f.shots.length, 0);
  const { d } = await makeDraft(f.id, 'shots', shotPlan(f.entities[0].id), {
    sceneId: f.scenes[0].id,
  });
  assert.equal(S.getFilm(f.id).shots.length, 0);
  const next = approve(f.id, d.id);
  assert.equal(next.shots.length, 1);
  assert.equal(next.shots[0].sceneId, f.scenes[0].id);
  assert.equal(next.shots[0].dialogueLines[0].text, 'חזרתי הביתה.');
  assert.equal(next.shots[0].dialogue, 'נועה: חזרתי הביתה.');
  assert.equal(next.shots[0].selectedVersionId, null);
  approve(f.id, d.id);
  assert.equal(S.getFilm(f.id).shots.length, 1, 'approval is idempotent');
  const other = S.createFilm({ title: 'Other film' });
  assert.throws(
    () => W.revisePlan(other.id, d.id, { note: 'wrong film' }),
    /not found/,
  );
});

void test('new screenplay replaces obsolete empty scenes while preserving produced scenes', async () => {
  const f = await developedFilm();
  S.addScene(f.id, { title: 'Old empty', heading: 'INT. OLD' });
  S.addScene(f.id, { title: 'Old produced', heading: 'INT. KEEP' });
  const old = S.getFilm(f.id).scenes.find((s) => s.title === 'Old empty');
  const produced = S.getFilm(f.id).scenes.find((s) => s.title === 'Old produced');
  S.addShot(f.id, { sceneId: produced.id, title: 'Produced shot', duration: 2 });
  const { d: draft } = await makeDraft(f.id, 'screenplay', {
    screenplay: 'new',
    scenes: [{ id: 'new-scene', title: 'New scene', heading: 'INT. NEW', summary: 'new' }],
    entities: [],
  });
  const result = approve(f.id, draft.id);
  assert.equal(result.scenes.some((s) => s.id === old.id), false);
  assert.equal(result.scenes.some((s) => s.id === produced.id), true);
  assert.equal(result.scenes.some((s) => s.title === 'New scene'), true);
});

void test('feedback and manual revisions preserve the original; revised shots keep selected media and edit order', async () => {
  const f = await developedFilm();
  const { d } = await makeDraft(f.id, 'shots', shotPlan(f.entities[0].id), {
    sceneId: f.scenes[0].id,
  });
  const applied = approve(f.id, d.id),
    sid = applied.shots[0].id;
  S.mutate(f.id, 'test.fixture', (film) => {
    film.shots[0].selectedVersionId = 'existing-media';
    film.shots[0].trimIn = 0.75;
  });
  W.revisePlan(f.id, d.id, { note: 'שנה רק את זווית המצלמה.' });
  const edited = structuredClone(d.content);
  edited.shots[0].camera = '85mm close-up';
  const changed = W.revisePlan(f.id, d.id, {
    content: edited,
    expectedRevision: S.getFilm(f.id).revision,
  });
  const revision = changed.workflow.drafts.at(-1);
  assert.equal(
    changed.workflow.drafts[2].content.shots[0].camera,
    '50mm, locked off',
  );
  assert.equal(revision.parentId, d.id);
  const after = approve(f.id, revision.id);
  assert.equal(after.shots.length, 1);
  assert.equal(after.shots[0].id, sid);
  assert.equal(after.shots[0].selectedVersionId, 'existing-media');
  assert.equal(after.shots[0].trimIn, 0.75);
  assert.equal(after.shots[0].camera, '85mm close-up');
  assert.equal(after.shots[0].continuityRevision, (applied.shots[0].continuityRevision || 0) + 1);
  assert.equal(
    after.workflow.drafts[2].notes[0].text,
    'שנה רק את זווית המצלמה.',
  );
});

void test('upstream changes block stale approval and concurrent edits cannot overwrite a draft', async () => {
  const f = await developedFilm();
  const { d } = await makeDraft(f.id, 'shots', shotPlan(f.entities[0].id), {
    sceneId: f.scenes[0].id,
  });
  const rev = S.getFilm(f.id).revision;
  S.editScene(f.id, f.scenes[0].id, {
    title: 'New scene direction',
    summary: 'Different direction',
  });
  assert.throws(
    () =>
      W.revisePlan(f.id, d.id, { content: d.content, expectedRevision: rev }),
    /film changed/,
  );
  assert.throws(() => approve(f.id, d.id), /Upstream direction changed/);
  assert.equal(W.workflowState(S.getFilm(f.id)).drafts.at(-1).stale, true);
});

void test('invalid and truncated AI output is archived but cannot enter production', async () => {
  const f = S.createFilm({ title: 'Invalid test' });
  output = { output: '{not valid', partial: true };
  const b = {
    stage: 'story',
    model: W.WRITERS[0],
    instructions: 'Write a story',
    language: 'he',
  };
  const p = W.planPreview(f.id, b);
  const request = {
    ...b,
    expectedRevision: p.filmRevision,
    idempotencyKey: S.uid(),
    confirmCost: true,
    acceptUnknownCost: true,
  };
  assert.throws(
    () => W.createPlan(f.id, { ...request, confirmCost: false }),
    /Confirm/,
  );
  W.createPlan(f.id, request);
  await new Promise((r) => setImmediate(r));
  const d = S.getFilm(f.id).workflow.drafts.at(-1);
  await W.refreshPlan(f.id, d.id);
  const result = S.getFilm(f.id);
  assert.equal(result.workflow.drafts.at(-1).status, 'failed');
  assert.equal(result.workflow.drafts.at(-1).result.output, '{not valid');
  assert.equal(result.logline, '');
  assert.throws(() => approve(f.id, d.id), /Only a ready draft/);
});

void test('uncertain planning submissions block automatic resubmission and can be reconciled', async () => {
  const factory = G.providerFactories.fal;
  G.providerFactories.fal = () => ({
    queue: {
      submit: async () => {
        throw Error('network response lost');
      },
    },
  });
  try {
    const f = S.createFilm({ title: 'Interrupted' });
    const { d } = await makeDraft(f.id, 'story', story);
    assert.equal(d.status, 'submission_unknown');
    assert.throws(
      () =>
        W.createPlan(f.id, {
          stage: 'story',
          instructions: 'Retry',
          model: W.WRITERS[0],
          expectedRevision: S.getFilm(f.id).revision,
          idempotencyKey: S.uid(),
          confirmCost: true,
          acceptUnknownCost: true,
        }),
      /pending request/,
    );
    const reconciled = W.revisePlan(f.id, d.id, {
      requestId: 'existing-request-12345',
    });
    assert.equal(reconciled.workflow.drafts[0].status, 'queued');
  } finally {
    G.providerFactories.fal = factory;
  }
});

void test('Hebrew TTS receives only spoken text and language; sound correction reaches the provider', () => {
  const f = S.createFilm({ title: 'Voice test' });
  const withShot = S.addShot(f.id, {
    title: 'Dialogue',
    prompt: 'person',
    dialogue: 'נועה: שלום',
  });
  const request = {
    shotId: withShot.shots[0].id,
    model: 'fal-ai/elevenlabs/tts/eleven-v3',
    prompt: 'שלום',
    correction: 'הגייה רכה',
    options: { language_code: 'he', voice: 'Rachel' },
  };
  const p = G.preview(f.id, request);
  assert.equal(p.input.text, 'שלום');
  assert.equal(p.input.language_code, 'he');
  assert.equal(p.input.timestamps, true);
  assert.throws(
    () => G.preview(f.id, { ...request, workflowTask: 'dialogue', prompt: 'יפה לי?' }),
    /Spoken text must match the approved dialogue exactly: שלום/,
  );
  const sound = G.preview(f.id, {
    ...request,
    model: 'fal-ai/stable-audio-25/text-to-audio',
    prompt: 'Rain',
    correction: 'No thunder',
    options: { seconds_total: 5 },
  });
  assert.match(sound.input.prompt, /CORRECTION: No thunder/);
  assert.throws(
    () =>
      M.buildInput(M.getModel(request.model), 'שלום', {
        language_code: 'invalid',
      }),
    /two-letter/,
  );
  assert.throws(
    () =>
      G.preview(f.id, {
        ...request,
        model: 'fal-ai/kling-video/v2.6/pro/image-to-video',
        workflowTask: 'video',
      }),
    /Approve a keyframe/,
  );
  assert.throws(
    () =>
      G.preview(f.id, {
        ...request,
        model: 'fal-ai/sync-lipsync/v2',
        workflowTask: 'lipsync',
      }),
    /Approve the picture and dialogue/,
  );
});

void test('Hebrew captions follow cut order with exact timing, and overlapping or out-of-shot cues are rejected', () => {
  const f = S.createFilm({ title: 'Captions' });
  let next = S.addShot(f.id, { title: 'First', duration: 5 });
  const a = next.shots[0].id;
  next = S.addShot(f.id, { title: 'Second', duration: 3 });
  const b = next.shots[1].id;
  S.editShot(f.id, a, {
    captions: [{ start: 1.2, end: 3.5, text: 'חזרתי הביתה.' }],
  });
  next = S.editShot(f.id, b, {
    captions: [{ start: 0, end: 2, text: 'ברוכה הבאה.' }],
  });
  assert.match(subtitles(next), /00:00:05,000 --> 00:00:07,000\nברוכה הבאה/);
  next = S.reorder(f.id, [b, a]);
  assert.match(subtitles(next), /00:00:04,200 --> 00:00:06,500\nחזרתי הביתה/);
  assert.throws(
    () => S.editShot(f.id, a, { captions: [{ start: 0, end: 6, text: 'no' }] }),
    /Caption end/,
  );
  assert.throws(
    () =>
      S.editShot(f.id, a, {
        captions: [
          { start: 0, end: 3, text: 'one' },
          { start: 2, end: 4, text: 'two' },
        ],
      }),
    /overlap/,
  );
  assert.throws(() => S.editShot(f.id, a, { duration: 2 }), /Adjust captions/);
});
