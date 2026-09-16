import { ASSET_VIEWS } from '../shared/asset-views.mjs';
import { createFalClient } from '@fal-ai/client';
import {
  getFilm,
  find,
  mutate,
  uid,
  now,
  fail,
  assemblePrompt,
  listFilms,
  qcComplete,
} from './store.mjs';
import { getModel, buildInput, estimate } from './models.mjs';
import { providerFile, downloadAsset } from './media.mjs';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { absolute } from './media.mjs';
import { secret } from './secrets.mjs';
export const providerFactories = {
  fal: () => createFalClient({ credentials: secret('FAL_KEY') }),
};
function providerKey(model) {
  return model.provider === 'runway' ? 'RUNWAY_API_KEY' : 'FAL_KEY';
}
async function localDataUri(version) {
  const bytes = await readFile(absolute(version.localPath));
  const ext = extname(version.localPath).toLowerCase();
  const type = ({'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.mp4':'video/mp4','.webm':'video/webm','.mov':'video/quicktime','.mp3':'audio/mpeg','.wav':'audio/wav'})[ext] || 'application/octet-stream';
  return `data:${type};base64,${bytes.toString('base64')}`;
}
const client = () => providerFactories.fal();
function spokenDialogue(dialogue = '') {
  const value = String(dialogue).trim();
  const spoken = value.includes(':') ? value.slice(value.lastIndexOf(':') + 1) : value;
  return spoken.replace(/[״“”"']/g, '').trim();
}
function normalizedSpeech(value = '') {
  return String(value)
    .replace(/[״“”"'.,!?…:;־-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
export function providerError(error) {
  if (['UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'SELF_SIGNED_CERT_IN_CHAIN'].includes(error?.cause?.code))
    return 'Secure provider connection failed: configure NODE_EXTRA_CA_CERTS with the trusted certificate bundle and restart the server.';
  const detail = error?.body?.detail;
  const messages = Array.isArray(detail)
    ? detail.map(item => typeof item?.msg === 'string' ? item.msg : '').filter(Boolean)
    : typeof detail === 'string' ? [detail] : [];
  return [...new Set(messages)].join(' ').slice(0, 2000) || String(error?.message || 'Provider request failed.');
}

export function prepare(id, b) {
  const f = getFilm(id),
    entity = b.entityId ? find(f, 'entities', b.entityId) : null,
    s = b.shotId
      ? find(f, 'shots', b.shotId)
      : entity
        ? {
            id: null,
            code: 'REF',
            title: `${entity.name} identity reference`,
            prompt: entity.description,
            camera: entity.type==='location' ? 'single coherent environment view, eye-level camera' : 'single subject reference, front three-quarter view',
            lighting: entity.type==='location' ? 'even readable scene illumination' : 'soft even studio light',
            continuity: entity.continuity,
            entityIds: [entity.id],
            dialogue: '',
          }
        : fail('Choose a shot or production-bible entry.'),
    m = getModel(b.model);
  if (b.parentVersionId) {
    const parent = find(f, 'versions', b.parentVersionId);
    if ((parent.entityId || null) !== (entity?.id || null) || (parent.shotId || null) !== (s.id || null))
      fail('Revision parent must belong to this asset or shot.');
    if (parent.kind !== m.kind) fail('A revision must keep its media type. Choose a model for the original image, video or audio.');
  }
  if (entity && m.kind !== 'image')
    fail('Identity references can only be generated with an image model.');
  if (typeof b.prompt !== 'string' || !b.prompt.trim())
    fail('Write a generation prompt.');
  const taskMatches = {
    keyframe: m.kind === 'image',
    dialogue: m.task === 'Dialogue / voice',
    video: m.task === 'Video',
    lipsync: m.task === 'Lip-sync',
    sfx: m.task === 'Music / sound effects',
    music: m.task === 'Music / sound effects',
  };
  if (b.workflowTask && taskMatches[b.workflowTask] !== true)
    fail('Choose a model for this workflow task.');
  if (b.workflowTask === 'dialogue' && s.dialogue) {
    const expected = spokenDialogue(s.dialogue);
    if (normalizedSpeech(b.prompt) !== normalizedSpeech(expected))
      fail(`Spoken text must match the approved dialogue exactly: ${expected}`, 409);
  }
  const refs = (b.references || []).map((id) => find(f, 'versions', id));
  if (b.assetView) {
    const view=ASSET_VIEWS[b.assetView];
    if (!entity || !view?.types.includes(entity.type)) fail('Choose a reference view for this asset type.');
    if (b.assetView !== 'master') {
      const base=refs.find(v=>v.id===b.assetBaseVersionId);
      if (!base || base.entityId!==entity.id || base.kind!=='image' || base.status!=='approved' || !qcComplete(f,base))
        fail('Approve and select a source image of this asset before creating another view.');
      if (!m.fields.some(field=>['image_urls','image_url'].includes(field))) fail('This view requires an image-reference model.');
    }
  }

  if (b.workflowTask === 'video' && s.connection?.mode === 'continue') {
    const ordered = [...f.shots].sort((a,b)=>a.order-b.order);
    const previous = ordered[ordered.findIndex(shot=>shot.id===s.id)-1];
    const link=s.connection;
    if (!previous || previous.id!==link.sourceShotId || previous.selectedVersionId!==link.sourceVersionId || (previous.trimIn||0)!==link.sourceTrimIn || previous.duration!==link.sourceDuration)
      fail('השוט הקודם השתנה. יש להכין מחדש את פריים החיבור לפני יצירת המשך.');
    if (!refs.some(v=>v.id===link.frameVersionId && v.status==='approved'))
      fail('להמשך רציף יש לאשר ולבחור את פריים החיבור כרפרנס.');
  }
  if (refs.some((v) => !v.localPath || v.status === 'rejected'))
    fail('References must be ready and not rejected.');
  if (
    b.workflowTask === 'video' &&
    !refs.some(
      (v) =>
        v.kind === 'image' &&
        v.shotId === s.id &&
        v.status === 'approved' &&
        qcComplete(f, v),
    )
  )
    fail('Approve a keyframe before animating this shot.', 409);
  if (
    b.workflowTask === 'lipsync' &&
    (!refs.some(
      (v) =>
        v.kind === 'video' &&
        v.shotId === s.id &&
        v.status === 'approved' &&
        qcComplete(f, v),
    ) ||
      !refs.some(
        (v) =>
          v.kind === 'audio' &&
          v.shotId === s.id &&
          v.status === 'approved' &&
          qcComplete(f, v),
      ))
  )
    fail('Approve the picture and dialogue recording before lip-sync.', 409);
  if (
    b.workflowTask === 'video' &&
    m.capabilities?.nativeLanguages &&
    !m.capabilities.nativeLanguages.includes('he') &&
    b.options?.generate_audio &&
    /[\u0590-\u05ff]/.test(s.dialogue || '')
  )
    fail(
      'Use separate Hebrew speech and lip-sync for this model; native dialogue supports English / Chinese.',
      409,
    );
  const compiled = assemblePrompt(entity ? {...f, style: ''} : f, s, b.prompt, b.correction || '');
  const options = {
    ...b.options,
    aspect_ratio: entity ? '1:1' : f.aspectRatio,
  };
  if (m.kind === 'image')
    options.image_size =
      entity
        ? 'square_hd'
        : f.aspectRatio === '9:16'
        ? 'portrait_16_9'
        : f.aspectRatio === '1:1'
          ? 'square_hd'
          : f.aspectRatio === '2.39:1'
            ? { width: 1536, height: 640 }
            : 'landscape_16_9';
  const images = refs.filter((v) => v.kind === 'image');
  if (m.fields.includes('image_urls'))
    options.image_urls = images.map((v) => `asset:${v.id}`);
  if (
    m.task === 'Video' &&
    refs.some(
      (v) =>
        v.kind !== 'image' &&
        !m.fields.includes(v.kind === 'video' ? 'video_urls' : 'audio_urls'),
    )
  )
    fail('This model does not accept all selected reference types.');
  if (m.task === 'Video' && images.length > m.capabilities.maxImageReferences)
    fail('Too many image references for this model.');
  if (m.fields.includes('image_url')) {
    options.image_url = images[0] ? `asset:${images[0].id}` : null;
    if (images[1]) options.end_image_url = `asset:${images[1].id}`;
  }
  if (m.fields.includes('video_urls'))
    options.video_urls = refs
      .filter((v) => v.kind === 'video')
      .map((v) => `asset:${v.id}`);
  if (m.fields.includes('audio_urls'))
    options.audio_urls = refs
      .filter((v) => v.kind === 'audio')
      .map((v) => `asset:${v.id}`);
  if (
    m.capabilities?.maxVideoReferences != null &&
    refs.filter((v) => v.kind === 'video').length >
      m.capabilities.maxVideoReferences
  )
    fail('Too many video references for this model.');
  if (
    m.capabilities?.maxAudioReferences != null &&
    refs.filter((v) => v.kind === 'audio').length >
      m.capabilities.maxAudioReferences
  )
    fail('Too many audio references for this model.');
  if (m.fields.includes('start_image_url')) {
    options.start_image_url = images[0] ? `asset:${images[0].id}` : null;
    if (images[1]) options.end_image_url = `asset:${images[1].id}`;
  }
  if (m.task === 'Lip-sync') {
    options.video_url = refs.find((v) => v.kind === 'video')
      ? `asset:${refs.find((v) => v.kind === 'video').id}`
      : null;
    options.audio_url = refs.find((v) => v.kind === 'audio')
      ? `asset:${refs.find((v) => v.kind === 'audio').id}`
      : null;
  }
  const text =
    m.kind === 'audio'
      ? m.task === 'Dialogue / voice'
        ? b.prompt
        : [b.prompt, b.correction ? `CORRECTION: ${b.correction}` : '']
            .filter(Boolean)
            .join('\n\n')
      : [
          compiled.prompt,
          m.task === 'Video' && options.generate_audio && s.dialogue
            ? `DIALOGUE & PERFORMANCE: ${s.dialogue}`
            : '',
        ]
          .filter(Boolean)
          .join('\n\n');
  const input = buildInput(m, text, options);
  return { f, s, m, refs, compiled, input, estimate: estimate(m, input) };
}
export function preview(id, b) {
  const p = prepare(id, b);
  return {
    model: p.m.name,
    input: p.input,
    estimate: p.estimate,
    filmRevision: p.f.revision,
    context: p.compiled.context,
  };
}
export function generate(id, b) {
  const requestedProviderKey = String(b.model || '').startsWith('runway/')
    ? 'RUNWAY_API_KEY'
    : 'FAL_KEY';
  if (!secret(requestedProviderKey))
    fail(
      `Add your ${requestedProviderKey === 'RUNWAY_API_KEY' ? 'Runway Dev' : 'FAL'} API key in Models & settings before generating.`,
      409,
    );
  if (b.confirmCost !== true)
    fail('Review the request and confirm generation.');
  const p = prepare(id, b);
  if (!secret(providerKey(p.m)))
    fail(`Add your ${p.m.provider === 'runway' ? 'Runway Dev' : 'FAL'} API key in Models & settings before generating.`, 409);
  if (!b.idempotencyKey || typeof b.idempotencyKey !== 'string')
    fail('Missing generation token');
  const existing = p.f.versions.find(
    (v) => v.idempotencyKey === b.idempotencyKey,
  );
  if (existing) return getFilm(id);
  if (b.expectedRevision !== p.f.revision)
    fail(
      'The production changed after this preview. Preview the request again.',
    );
  const spent =
    p.f.versions.reduce(
      (n, v) => n + (v.actualCost ?? v.estimatedCost ?? 0),
      0,
    ) +
    (p.f.workflow?.drafts || [])
      .filter((d) => d.source !== 'manual-revision')
      .reduce((n, d) => n + (d.actualCost || 0), 0);
  if (p.estimate != null && spent + p.estimate > p.f.budget)
    fail(
      'This request exceeds the film budget. Adjust the budget in settings.',
    );
  if (p.estimate == null && b.acceptUnknownCost !== true)
    fail(
      'This model has unverified pricing. Acknowledge the unknown cost before submitting.',
    );
  const vid = uid();
  const film = mutate(id, 'generation.reserved', (f) => {
    const v = {
      id: vid,
      shotId: p.s.id || null,
      entityId: b.entityId || null,
      assetView: b.assetView || null,
      assetBaseVersionId: b.assetBaseVersionId || null,
      label: b.entityId ? `Identity reference · ${p.m.name}` : p.m.name,
      // Version numbers belong to an asset branch. A keyframe image must not
      // consume the first number of the later video (or lip-sync) branch for
      // the same shot. Keep the workflow task in the branch key so each
      // production step has a clear, replaceable history of its own.
      number:
        [...f.versions, ...(f.archivedVersions || [])].filter((v) =>
          (b.entityId ? v.entityId === b.entityId : v.shotId === p.s.id) &&
          v.kind === p.m.kind &&
          (v.workflowTask || null) === (b.workflowTask || null),
        ).length + 1,
      source: 'generation',
      kind: p.m.kind,
      model: p.m.id,
      provider: p.m.provider,
      prompt: b.prompt,
      compiledPrompt: p.compiled.prompt,
      correction: b.correction || '',
      parentVersionId: b.parentVersionId || null,
      workflowTask: b.workflowTask || null,
      dialogueLineId: b.dialogueLineId || null,
      audioRole: ['dialogue', 'music', 'sfx'].includes(b.audioRole)
        ? b.audioRole
        : null,
      references: p.refs.map((v) => v.id),
      input: p.input,
      context: p.compiled.context,
      bibleRevision: f.bibleRevision,
      createdAt: now(),
      status: 'submitting',
      checks: {},
      notes: [],
      estimatedCost: p.estimate,
      actualCost: null,
      idempotencyKey: b.idempotencyKey,
    };
    if (v.parentVersionId) {
      const parent = find(f, 'versions', v.parentVersionId);
      if (parent.shotId !== p.s.id)
        fail('Revision parent must belong to this shot.');
    }
    f.versions.push(v);
    return v;
  });
  void submit(id, vid);
  return film;
}
async function submit(id, vid) {
  let sent = false;
  try {
    const f = getFilm(id),
      v = find(f, 'versions', vid),
      fal = client(),
      input = structuredClone(v.input);
    for (const key of [
      'image_urls',
      'image_url',
      'start_image_url',
      'end_image_url',
      'audio_url',
      'video_url',
      'audio_urls',
      'video_urls',
    ])
      if (input[key]) {
        const convert = async (s) => {
          if (!String(s).startsWith('asset:'))
            fail('Reference must be a local production asset.');
          return providerFile(find(f, 'versions', s.slice(6)), fal);
        };
        input[key] = Array.isArray(input[key])
          ? await Promise.all(input[key].map(convert))
          : await convert(input[key]);
      }
    if (v.provider === 'runway') {
      const images = (v.references || []).map((rid) => find(f, 'versions', rid)).filter((x) => x.kind === 'image');
      const videos = (v.references || []).map((rid) => find(f, 'versions', rid)).filter((x) => x.kind === 'video');
      const audios = (v.references || []).map((rid) => find(f, 'versions', rid)).filter((x) => x.kind === 'audio');
      const runwayInput = { model: v.model.replace(/^runway\//, ''), promptText: input.prompt, duration: Number(input.duration), ratio: '1280:720' };
      if (input.resolution) runwayInput.resolution = input.resolution;
      if (input.generate_audio !== undefined) runwayInput.audio = Boolean(input.generate_audio);
      if (images[0]) runwayInput.promptImage = await localDataUri(images[0]);
      if (images[1]) runwayInput.lastFrame = await localDataUri(images[1]);
      if (videos.length) runwayInput.referenceVideo = await localDataUri(videos[0]);
      if (audios.length) runwayInput.referenceAudio = await localDataUri(audios[0]);
      const response = await fetch('https://api.dev.runwayml.com/v1/image_to_video', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret('RUNWAY_API_KEY')}`, 'X-Runway-Version': '2024-11-06' }, body: JSON.stringify(runwayInput), signal: AbortSignal.timeout(120000) });
      if (!response.ok) throw new Error(`Runway Dev request failed (${response.status}).`);
      const task = await response.json();
      mutate(id, 'generation.submitted', (f) => { Object.assign(find(f, 'versions', vid), { requestId: task.id, status: 'queued' }); return { versionId: vid, requestId: task.id }; });
      return;
    }
    mutate(id, 'generation.input_uploaded', (f) => {
      find(f, 'versions', vid).providerInput = input;
      return { versionId: vid, input };
    });
    sent = true;
    const job = await fal.queue.submit(v.model, { input });
    mutate(id, 'generation.submitted', (f) => {
      Object.assign(find(f, 'versions', vid), {
        requestId: job.request_id,
        status: 'queued',
      });
      return { versionId: vid, requestId: job.request_id };
    });
  } catch (e) {
    mutate(id, 'generation.submit_failed', (f) => {
      Object.assign(find(f, 'versions', vid), {
        status: sent ? 'submission_unknown' : 'failed',
        error: sent
          ? 'Submission outcome is unknown. Check the FAL dashboard before creating another request.'
          : providerError(e),
      });
      return { versionId: vid, error: providerError(e) };
    });
  }
}
const active = new Set();
export async function refreshJob(id, vid) {
  const key = id + vid;
  if (active.has(key)) return;
  active.add(key);
  try {
    const v = find(getFilm(id), 'versions', vid);
    if (
      !v.requestId ||
      !['queued', 'running', 'archive_failed'].includes(v.status)
    )
      return;
    const fal = client();
    if (v.provider === 'runway') {
      const response = await fetch(`https://api.dev.runwayml.com/v1/tasks/${v.requestId}`, { headers: { Authorization: `Bearer ${secret('RUNWAY_API_KEY')}`, 'X-Runway-Version': '2024-11-06' }, signal: AbortSignal.timeout(120000) });
      if (!response.ok) throw new Error(`Runway Dev status failed (${response.status}).`);
      const state = await response.json();
      if (state.status === 'RUNNING' || state.status === 'PENDING') return;
      if (state.status !== 'SUCCEEDED') fail(state.failure || 'Runway Dev generation failed.');
      const url = state.output?.[0];
      if (!url) fail('Runway Dev completed without a video result.');
      mutate(id, 'generation.result_received', (f) => { Object.assign(find(f, 'versions', vid), { result: state, remoteUrl: url }); return { versionId: vid, result: state }; });
      const media = await downloadAsset(url);
      mutate(id, 'generation.archived', (f) => { Object.assign(find(f, 'versions', vid), media, { status: 'review', completedAt: now(), error: null }); return { versionId: vid, sha256: media.sha256 }; });
      return;
    }
    const state = await fal.queue.status(v.model, {
      requestId: v.requestId,
      logs: true,
    });
    if (state.status !== 'COMPLETED') {
      if (v.status !== 'running' && state.status === 'IN_PROGRESS')
        mutate(id, 'generation.running', (f) => {
          find(f, 'versions', vid).status = 'running';
          return { versionId: vid };
        });
      return;
    }
    const result = await fal.queue.result(v.model, { requestId: v.requestId });
    const data = result.data;
    const output = data.images?.[0] || data.video || data.audio;
    const url = typeof output === 'string' ? output : output?.url;
    if (!url) fail('Provider completed without a supported media result.');
    mutate(id, 'generation.result_received', (f) => {
      Object.assign(find(f, 'versions', vid), { result: data, remoteUrl: url });
      return { versionId: vid, result: data };
    });
    const media = await downloadAsset(url);
    mutate(id, 'generation.archived', (f) => {
      Object.assign(find(f, 'versions', vid), media, {
        status: 'review',
        completedAt: now(),
        error: null,
      });
      return { versionId: vid, sha256: media.sha256 };
    });
  } catch (e) {
    const v = find(getFilm(id), 'versions', vid);
    if (v.remoteUrl && v.error !== providerError(e))
      mutate(id, 'generation.archive_failed', (f) => {
        Object.assign(find(f, 'versions', vid), {
          status: 'archive_failed',
          error: providerError(e),
        });
        return { versionId: vid, error: providerError(e) };
      });
    else if (e.status === 422 || e.status === 400 || e.status === 404)
      mutate(id, 'generation.failed', (f) => {
        Object.assign(find(f, 'versions', vid), {
          status: 'failed',
          error: providerError(e),
        });
        return { versionId: vid, error: providerError(e) };
      });
  } finally {
    active.delete(key);
  }
}
export function startWorker() {
  for (const row of listFilms()) {
    const f = getFilm(row.id);
    for (const v of f.versions)
      if (v.status === 'submitting')
        mutate(f.id, 'generation.interrupted', (f) => {
          Object.assign(find(f, 'versions', v.id), {
            status: 'submission_unknown',
            error:
              'Application stopped during submission. Reconcile the request ID from your FAL dashboard before retrying.',
          });
          return { versionId: v.id };
        });
  }
  return setInterval(() => {
    if (!secret('FAL_KEY')) return;
    for (const row of listFilms())
      for (const v of getFilm(row.id).versions)
        if (['queued', 'running', 'archive_failed'].includes(v.status))
          void refreshJob(row.id, v.id);
  }, 5000);
}
export function reconcile(id, vid, b) {
  return mutate(id, 'generation.reconciled', (f) => {
    const v = find(f, 'versions', vid);
    if (v.status !== 'submission_unknown')
      fail('Only unknown submissions can be reconciled.');
    if (!/^[a-zA-Z0-9_-]{10,100}$/.test(b.requestId || ''))
      fail('Enter the request ID from the FAL dashboard.');
    v.requestId = b.requestId;
    v.status = 'queued';
    v.error = null;
    return { versionId: vid, requestId: b.requestId };
  });
}
