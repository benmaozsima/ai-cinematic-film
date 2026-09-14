import { createHash } from 'node:crypto';
import {
  getFilm,
  prepareLocationsForShots,
  listFilms,
  mutate,
  find,
  uid,
  now,
  fail,
  required,
  number,
} from './store.mjs';
import { providerFactories } from './generation.mjs';
import { secret } from './secrets.mjs';

export const WRITERS = [
  'google/gemini-2.5-flash',
  'anthropic/claude-sonnet-4.5',
  'openai/gpt-5-mini',
];
const endpoint = 'fal-ai/any-llm';
const drafts = (f) => f.workflow?.drafts || [];
const draft = (f, id) =>
  drafts(f).find((d) => d.id === id) || fail('Draft not found.', 404);
const selected = (f, stage, sceneId = '') =>
  [...drafts(f)]
    .reverse()
    .find(
      (d) =>
        d.stage === stage && d.sceneId === sceneId && d.status === 'approved',
    );
function context(f, stage, sceneId) {
  const base = {
    title: f.title,
    logline: f.logline,
    style: f.style,
    treatment: f.treatment || '',
  };
  if (stage === 'story') return { title: f.title };
  if (stage === 'screenplay')
    return {
      ...base,
      storyApproval: selected(f, 'story')?.id,
      ...(sceneId ? { focusScene: find(f, 'scenes', sceneId) } : {}),
    };
  return {
    ...base,
    screenplay: f.screenplay,
    scene: find(f, 'scenes', sceneId),
    entities: f.entities,
    screenplayApproval: selected(f, 'screenplay')?.id,
  };
}
const fingerprint = (v) =>
  createHash('sha256').update(JSON.stringify(v)).digest('hex');
function targets(f, stage, sceneId) {
  if (stage === 'story')
    return { logline: f.logline, treatment: f.treatment || '', style: f.style };
  if (stage === 'screenplay')
    return { screenplay: f.screenplay, scenes: f.scenes, entities: f.entities };
  return f.shots
    .filter((s) => s.sceneId === sceneId)
    .map((s) =>
      Object.fromEntries(
        [
          'id',
          'title',
          'prompt',
          'dialogue',
          'dialogueLines',
          'duration',
          'camera',
          'lighting',
          'continuity',
          'entityIds',
          'soundEffects',
          'music',
          'onScreenText',
        ].map((key) => [key, s[key]]),
      ),
    );
}
export function workflowState(f) {
  return {
    writers: WRITERS,
    drafts: drafts(f).map((d) => ({
      ...d,
      focusSceneId: d.focusSceneId || null,
      stale:
        (d.appliedContextHash || d.contextHash) !==
          fingerprint(context(f, d.stage, d.focusSceneId || d.sceneId)) ||
        (d.status !== 'approved' &&
          d.targetHash !==
            fingerprint(targets(f, d.stage, d.focusSceneId || d.sceneId))),
    })),
  };
}
const schemas = {
  story: {
    logline: 'one sentence',
    treatment: 'story with beginning, turning point and ending',
    style: 'consistent visual and camera language',
  },
  screenplay: {
    screenplay:
      'complete screenplay including exact spoken words and scene headings',
    entities: [
      {
        id: 'preserve existing id when revising, otherwise omit',
        type: 'character or location or prop',
        name: 'name',
        description: 'identity / age / wardrobe / features / proportions',
        continuity: 'immutable visual rules',
        voice: 'Rachel or chosen ElevenLabs voice ID for a character',
      },
    ],
    scenes: [
      {
        id: 'preserve existing id when revising, otherwise omit',
        title: 'INT/EXT. LOCATION - TIME',
        summary:
          'action, emotional beat, exact dialogue, sound cues and transition',
      },
    ],
  },
  shots: {
    shots: [
      {
        id: 'preserve existing id when revising, otherwise omit',
        title: 'shot name',
        prompt: 'detailed visual direction in English',
        camera: 'lens, framing, movement, eyeline and screen direction',
        lighting: 'light and time of day',
        continuity: 'connections to adjacent shots',
        duration: 5,
        dialogueLines: [
          {
            speaker: 'exact character name',
            text: 'only words spoken, in the requested language',
            voice: 'character voice name or ID',
          },
        ],
        soundEffects: 'isolated foley / ambience prompt in English',
        music:
          'instrumental score direction in English, or empty when unnecessary',
        onScreenText:
          'exact titles / signs / captions separately, never rely on generated text being accurate',
        entityIds: ['actual relevant entity ids from context'],
      },
    ],
  },
};
function cleanContent(stage, value, f, sceneId) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    fail('The AI response must be an object.');
  const text = (v, label, max = 30000) => required(v, label, max);
  const optional = (v) => String(v || '').slice(0, 20000);
  const rows = (v, label, max) => {
    if (
      !Array.isArray(v) ||
      v.length > max ||
      (!v.length && label !== 'entities')
    )
      fail(`Invalid ${label} (maximum ${max}).`);
    return v;
  };
  const seen = new Set();
  const rowId = (v, collection) => {
    const id = v.id && collection.some((r) => r.id === v.id) ? v.id : uid();
    if (seen.has(id)) fail('Duplicate item in draft.');
    seen.add(id);
    return id;
  };
  if (stage === 'story')
    return {
      logline: text(value.logline, 'Logline', 1000),
      treatment: text(value.treatment, 'Treatment'),
      style: text(value.style, 'Style'),
    };
  if (stage === 'screenplay') {
    const sceneRows = sceneId
      ? rows(value.scenes || (value.scene ? [value.scene] : []), 'scenes', 1)
      : rows(value.scenes, 'scenes', 12);
    if (sceneId && sceneRows[0] && !sceneRows[0].id) sceneRows[0].id = sceneId;
    const mergedScenes = sceneId
      ? f.scenes.map(
          (existing) =>
            sceneRows.find((row) => row.id === existing.id) || existing,
        )
      : sceneRows;
    return {
      screenplay: text(value.screenplay || f.screenplay, 'Screenplay', 80000),
      entities: rows(value.entities || f.entities, 'entities', 30).map((e) => ({
        id: rowId(e, f.entities),
        type: ['character', 'location', 'prop'].includes(e.type)
          ? e.type
          : 'character',
        name: text(e.name, 'Name', 160),
        description: optional(e.description),
        continuity: optional(e.continuity),
        voice: optional(e.voice),
      })),
      scenes: mergedScenes.map((s) => ({
        id: rowId(s, f.scenes),
        title: text(s.title, 'Scene title', 200),
        summary: text(s.summary, 'Scene direction'),
      })),
    };
  }
  return {
    shots: rows(value.shots, 'shots', 12).map((s) => ({
      id: rowId(
        s,
        f.shots.filter((s) => s.sceneId === sceneId),
      ),
      title: text(s.title, 'Shot title', 200),
      prompt: text(s.prompt, 'Visual prompt'),
      camera: optional(s.camera),
      lighting: optional(s.lighting),
      continuity: optional(s.continuity),
      duration: number(s.duration, 1, 10, 'Shot duration'),
      dialogueLines: (Array.isArray(s.dialogueLines) ? s.dialogueLines : [])
        .slice(0, 8)
        .map((l, i) => ({
          id: `line-${i + 1}`,
          speaker: text(l.speaker, 'Speaker', 160),
          text: text(l.text, 'Spoken words', 3000),
          voice:
            optional(l.voice) ||
            f.entities.find((e) => e.name === l.speaker)?.voice ||
            'Rachel',
        })),
      soundEffects: optional(s.soundEffects),
      music: optional(s.music),
      onScreenText: optional(s.onScreenText),
      entityIds: [
        ...new Set(
          (Array.isArray(s.entityIds) ? s.entityIds : []).filter((id) =>
            f.entities.some((e) => e.id === id),
          ),
        ),
      ],
    })),
  };
}
export function planPreview(id, b) {
  const f = getFilm(id);
  if (!schemas[b.stage]) fail('Choose a writing stage.');
  const sceneId = b.stage === 'shots' ? required(b.sceneId, 'Scene') : '';
  const focusSceneId =
    b.stage === 'screenplay' ? String(b.sceneId || '') : sceneId;
  const currentApproval = (stage) => {
    const d = selected(f, stage);
    return d && d.contextHash === fingerprint(context(f, stage, ''));
  };
  if (b.stage === 'screenplay' && !currentApproval('story'))
    fail('Approve the story first.', 409);
  if (b.stage === 'shots' && !currentApproval('screenplay'))
    fail('Approve the screenplay first.', 409);
  if (!WRITERS.includes(b.model)) fail('Choose a supported writing model.');
  const parent = b.parentId ? draft(f, b.parentId) : null;
  if (
    parent &&
    (parent.stage !== b.stage || parent.sceneId !== sceneId || !parent.content)
  )
    fail('Choose a draft from this stage.');
  const instructions = required(b.instructions, 'Creative instructions', 12000);
  const source = context(f, b.stage, focusSceneId);
  const input = {
    model: b.model,
    max_tokens: b.stage === 'screenplay' ? 10000 : 6500,
    temperature: 0.6,
    system_prompt: `You are a professional film development assistant. Work ONLY on the requested stage. Return a complete JSON object, no markdown. Never generate or claim to generate media. Preserve character identity, geography, props, screen direction, emotional continuity and exact dialogue. User-facing prose and dialogue must be in ${b.language === 'en' ? 'English' : 'Hebrew'}. Visual and sound generation prompts must be in English. Use one speaking character per shot and short lines that fit a 5 or 10 second shot; split long speech and alternate speakers into separate shots. Never put speaker names or stage directions inside spoken text. Include separate music, ambience/foley and readable on-screen text instructions. Hebrew dialogue uses separately generated speech then lip-sync; native dialogue is an optional English/Chinese workflow. Preserve all existing item IDs supplied by the previous draft. No more than 12 scenes or 12 shots for the one requested scene. ${b.stage === 'screenplay' && b.sceneId ? `EDIT SCOPE: edit ONLY scene ${b.sceneId}. Return exactly one item in scenes with that same id, plus optional screenplay text. Do not create, remove, rename, or rewrite any other scene.` : ''} Output schema: ${JSON.stringify(schemas[b.stage])}`,
    prompt: JSON.stringify({
      stage: b.stage,
      instructions,
      approvedContext: source,
      currentProduction: targets(f, b.stage, sceneId),
      previousDraft: parent?.content,
      feedback: parent?.notes || [],
    }),
  };
  return {
    input,
    contextHash: fingerprint(source),
    targetHash: fingerprint(targets(f, b.stage, focusSceneId)),
    filmRevision: f.revision,
    estimate: null,
    endpoint,
    sceneId,
    focusSceneId,
  };
}
export function createPlan(id, b) {
  const f = getFilm(id);
  const existing = drafts(f).find((d) => d.token === b.idempotencyKey);
  if (existing && b.idempotencyKey) return f;
  if (!secret('FAL_KEY')) fail('Add a FAL key in settings.', 409);
  if (b.confirmCost !== true || b.acceptUnknownCost !== true)
    fail('Confirm the model charge before generation.');
  required(b.idempotencyKey, 'Generation token', 100);
  const p = planPreview(id, b);
  if (b.expectedRevision !== f.revision)
    fail('The film changed. Preview again.', 409);
  if (
    drafts(f).some(
      (d) =>
        d.stage === b.stage &&
        d.sceneId === p.sceneId &&
        ['submitting', 'queued', 'running', 'submission_unknown'].includes(
          d.status,
        ),
    )
  )
    fail(
      'This stage already has a pending request. Reconcile it before starting another.',
      409,
    );
  const did = uid();
  const result = mutate(id, 'workflow.reserved', (f) => {
    f.workflow ||= { drafts: [] };
    const d = {
      id: did,
      stage: b.stage,
      sceneId: p.sceneId,
      focusSceneId: p.focusSceneId || null,
      parentId: b.parentId || null,
      model: b.model,
      provider: 'fal',
      endpoint,
      input: p.input,
      contextHash: p.contextHash,
      targetHash: p.targetHash,
      instructions: b.instructions,
      language: b.language === 'en' ? 'en' : 'he',
      status: 'submitting',
      token: b.idempotencyKey,
      notes: [],
      createdAt: now(),
      estimatedCost: null,
      actualCost: null,
    };
    f.workflow.drafts.push(d);
    return d;
  });
  void submitPlan(id, did);
  return result;
}
async function submitPlan(id, did) {
  try {
    const d = draft(getFilm(id), did);
    const job = await providerFactories
      .fal()
      .queue.submit(endpoint, { input: d.input });
    mutate(id, 'workflow.submitted', (f) =>
      Object.assign(draft(f, did), {
        requestId: job.request_id,
        status: 'queued',
      }),
    );
  } catch (e) {
    mutate(id, 'workflow.submission_unknown', (f) =>
      Object.assign(draft(f, did), {
        status: [400, 401, 403, 404, 422, 429].includes(e.status)
          ? 'failed'
          : 'submission_unknown',
        error: `Check FAL before retrying: ${e.message}`,
      }),
    );
  }
}
const active = new Set();
export async function refreshPlan(id, did) {
  const key = `${id}/${did}`;
  if (active.has(key)) return;
  active.add(key);
  try {
    const d = draft(getFilm(id), did);
    if (!d.requestId || !['queued', 'running'].includes(d.status)) return;
    const fal = providerFactories.fal();
    const state = await fal.queue.status(endpoint, { requestId: d.requestId });
    if (state.status !== 'COMPLETED') {
      if (state.status === 'IN_PROGRESS' && d.status !== 'running')
        mutate(id, 'workflow.running', (f) => {
          draft(f, did).status = 'running';
          return { draftId: did };
        });
      return;
    }
    const result = await fal.queue.result(endpoint, { requestId: d.requestId });
    // Keep the raw response even when the model returns incomplete or invalid JSON.
    mutate(id, 'workflow.response', (f) => {
      draft(f, did).result = result.data;
      return { draftId: did, result: result.data };
    });
    if (result.data.partial || result.data.error)
      fail(
        result.data.error ||
          'The response was truncated. Shorten the requested scope.',
      );
    let parsed;
    try {
      parsed = JSON.parse(
        String(result.data.output)
          .replace(/^```(?:json)?\s*/i, '')
          .replace(/\s*```$/, ''),
      );
    } catch {
      fail(
        'The model returned invalid JSON. The raw response is preserved; request a shorter new draft.',
      );
    }
    const content = cleanContent(
      d.stage,
      parsed,
      getFilm(id),
      d.focusSceneId || d.sceneId,
    );
    mutate(id, 'workflow.ready', (f) =>
      Object.assign(draft(f, did), {
        content,
        status: 'review',
        completedAt: now(),
        error: null,
      }),
    );
  } catch (e) {
    const d = draft(getFilm(id), did);
    if (d.result || [400, 404, 422].includes(e.status))
      mutate(id, 'workflow.failed', (f) =>
        Object.assign(draft(f, did), {
          status: 'failed',
          error: String(e.message),
        }),
      );
  } finally {
    active.delete(key);
  }
}
export function revisePlan(id, did, b) {
  return mutate(id, 'workflow.reviewed', (f) => {
    const d = draft(f, did);
    if (b.requestId) {
      if (
        d.status !== 'submission_unknown' ||
        !/^[a-zA-Z0-9_-]{10,100}$/.test(b.requestId)
      )
        fail('A valid FAL request ID is required.');
      Object.assign(d, {
        requestId: b.requestId,
        status: 'queued',
        error: null,
      });
    }
    if (b.actualCost !== undefined)
      d.actualCost = number(b.actualCost, 0, 1000000, 'Actual billed cost');
    if (b.note)
      d.notes.push({
        id: uid(),
        text: required(b.note, 'Feedback'),
        at: now(),
      });
    if (b.reject) {
      if (d.status !== 'review') fail('Only a review draft can be rejected.');
      d.status = 'rejected';
    }
    if (b.content) {
      if (!d.content) fail('Wait for the draft to finish.');
      if (b.expectedRevision !== f.revision)
        fail('The film changed. Reload before saving.', 409);
      const content = cleanContent(
        d.stage,
        b.content,
        {
          ...f,
          scenes: [...f.scenes, ...(d.content.scenes || [])],
          entities: [...f.entities, ...(d.content.entities || [])],
          shots: [
            ...f.shots,
            ...(d.content.shots || []).map((s) => ({
              ...s,
              sceneId: d.sceneId,
            })),
          ],
        },
        d.focusSceneId || d.sceneId,
      );
      f.workflow.drafts.push({
        ...structuredClone(d),
        id: uid(),
        parentId: did,
        content,
        contextHash: d.appliedContextHash || d.contextHash,
        appliedContextHash: null,
        targetHash: fingerprint(
          targets(f, d.stage, d.focusSceneId || d.sceneId),
        ),
        status: 'review',
        source: 'manual-revision',
        token: uid(),
        notes: [],
        createdAt: now(),
        approvedAt: null,
        appliedIds: null,
        actualCost: 0,
      });
    }
    return {
      draftId: did,
      note: b.note,
      manualRevision: !!b.content,
      rejected: !!b.reject,
      actualCost: b.actualCost,
      requestId: b.requestId,
    };
  });
}
export function approvePlan(id, did, b) {
  return mutate(id, 'workflow.approved', (f) => {
    const d = draft(f, did);
    if (d.status === 'approved') return { draftId: did, alreadyApplied: true };
    if (d.status !== 'review') fail('Only a ready draft can be approved.');
    if (b.expectedRevision !== f.revision)
      fail('The film changed. Review the current draft.', 409);
    if (
      d.contextHash !==
      fingerprint(context(f, d.stage, d.focusSceneId || d.sceneId))
    )
      fail(
        'Upstream direction changed. Generate a revised draft against the current story.',
        409,
      );
    if (
      d.targetHash !==
      fingerprint(targets(f, d.stage, d.focusSceneId || d.sceneId))
    )
      fail(
        'Production text changed since this draft. Generate a revision to merge the latest direction.',
        409,
      );
    const c = d.content;
    if (d.stage === 'story') {
      Object.assign(f, {
        logline: c.logline,
        treatment: c.treatment,
        style: c.style,
      });
      f.bibleRevision++;
    } else if (d.stage === 'screenplay') {
      f.screenplay = c.screenplay;
      // A newly approved screenplay is the active plan. Remove obsolete
      // empty scenes from the production map; scenes with any shot/media
      // remain so an approved production record can never be orphaned.
      const sceneRows = c.scenes.map((row) => ({ ...row, id: row.id || uid() }));
      const incomingSceneIds = new Set(sceneRows.map((row) => row.id));
      f.scenes = f.scenes.filter((scene) =>
        incomingSceneIds.has(scene.id) ||
        f.shots.some((shot) => shot.sceneId === scene.id),
      );
      for (const row of sceneRows) {
        const existing = f.scenes.find((s) => s.id === row.id);
        if (existing) Object.assign(existing, row);
        else f.scenes.push({ ...row, order: f.scenes.length });
      }
      for (const row of c.entities) {
        const existing = f.entities.find((e) => e.id === row.id);
        if (
          existing?.locked &&
          Object.keys(row).some(
            (key) => String(row[key] || '') !== String(existing[key] || ''),
          )
        )
          fail(
            'Unlock existing bible entries before applying revised character / location direction.',
          );
        if (existing) Object.assign(existing, row);
        else
          f.entities.push({ ...row, locked: false, referenceVersionIds: [] });
      }
      f.bibleRevision++;
    } else {
      const newShotIds = [];
      for (const row of c.shots) {
        const existing = f.shots.find((s) => s.id === row.id);
        if (existing?.captions?.some((c) => c.end > row.duration))
          fail('Adjust captions before shortening this shot.');
        const fields = {
          ...row,
          sceneId: d.sceneId,
          entityIds: [...new Set([
            ...(Array.isArray(row.entityIds) ? row.entityIds : []),
            ...[...(existing?.entityIds || []), ...(existing?.locationEntityIds || [])]
              .filter(id => f.entities.some(e=>e.id===id && e.type==='location')),
          ])],
          locationEntityIds: [],
          dialogue: row.dialogueLines
            .map((l) => `${l.speaker}: ${l.text}`)
            .join('\n'),
          workflowDraftId: did,
        };
        if (existing)
          Object.assign(existing, fields, {
            continuityRevision: (existing.continuityRevision || 0) + 1,
          });
        else {
          newShotIds.push(row.id);
          f.shots.push({
            ...fields,
            code: `SH${String(f.shots.length + 1).padStart(3, '0')}`,
            trimIn: 0,
            entityIds: fields.entityIds,
            referenceVersionIds: [],
            selectedVersionId: null,
            order: f.shots.length,
          });
        }
      }
      prepareLocationsForShots(f, newShotIds);
    }
    Object.assign(d, { status: 'approved', approvedAt: now() });
    d.appliedContextHash = fingerprint(context(f, d.stage, d.focusSceneId || d.sceneId));
    return { draftId: did, stage: d.stage, content: c };
  });
}
export function startPlanningWorker() {
  for (const row of listFilms())
    for (const d of drafts(getFilm(row.id)))
      if (d.status === 'submitting')
        mutate(row.id, 'workflow.interrupted', (f) =>
          Object.assign(draft(f, d.id), {
            status: 'submission_unknown',
            error:
              'Application stopped during submission. Reconcile the request ID from FAL.',
          }),
        );
  return setInterval(() => {
    if (!secret('FAL_KEY')) return;
    for (const row of listFilms())
      for (const d of drafts(getFilm(row.id)))
        if (['queued', 'running'].includes(d.status))
          void refreshPlan(row.id, d.id);
  }, 4000);
}
