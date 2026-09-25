import { fail, getFilm, mutate, required, now } from './store.mjs';
import { inputManifest, recommendModels } from './model-router.mjs';
import { authorizationForQuote, quoteForPlan } from './director-budget.mjs';
import { normalizeBrief, proposalShotPlan, stableHash, validateProposal } from './director-contract.mjs';
import { getModel, buildInput, estimate, supportedDuration } from './models.mjs';
import { transitionDirectorTask } from './director-task-store.mjs';

// Keep this ID aligned with the active capability registry in models.mjs.
// The provider adapter adds the FAL namespace when submitting the request.
const VIDEO_MODEL = 'bytedance/seedance-2.5/text-to-video';
const IMAGE_MODEL = 'fal-ai/qwen-image';
const VOICE_MODEL = 'fal-ai/elevenlabs/tts/eleven-v3';

function validateInputs(film, inputs) {
  return inputs.map((input) => {
    const version = film.versions.find((item) => item.id === input?.id);
    if (!version || !version.localPath || version.status === 'rejected')
      fail('Every chat attachment must be a ready local production asset before planning.', 409);
    if (input.kind && input.kind !== version.kind)
      fail('An attached asset type does not match the stored production asset.', 409);
    const scope = String(input.scope || 'auto');
    if (!['auto', 'all'].includes(scope) && !/^beat-\d+$/.test(scope))
      fail('A reference scope must be automatic, all shots, or one planned shot.', 409);
    return { ...input, kind: version.kind, label: version.label || version.input?.filename || `${version.kind} reference`, scope };
  });
}

const sharedRoles = new Set(['style', 'composition']);
const togetherPattern = /(?:together|both (?:characters|models|people|actors)|both of them|the couple|\bthey\b|(?:a|the) man and (?:a|the) woman|(?:a|the) woman and (?:a|the) man|man and woman|woman and man|all (?:characters|models|people|actors)|שתי הדמויות|גבר ואישה|אישה וגבר|שני הדוגמנים|שתי הדוגמניות|שניהם|שתיהן|הזוג|\bהם\b|\bהן\b|כולם|כולן)/iu;
function searchableLabel(value = '') {
  return String(value).replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\b(?:img|image|photo|video|audio|whatsapp)\b/giu, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

// Resolve references before any paid job is submitted. Automatic mode uses
// filenames/names when the brief mentions them, keeps true style references
// global, and distributes multiple characters/locations/props across shots.
// The chat can override this with scope=all or scope=beat-N.
export function assignReferencesToShots(inputs = [], shots = []) {
  const assignments = shots.map((shot) => ({ shotId: shot.id, inputIds: [] }));
  const add = (shotId, inputId) => {
    const row = assignments.find((item) => item.shotId === shotId);
    if (row && !row.inputIds.includes(inputId)) row.inputIds.push(inputId);
  };
  const groups = new Map();
  for (const input of inputs) {
    const role = input.role || 'reference';
    if (!groups.has(role)) groups.set(role, []);
    groups.get(role).push(input);
  }
  for (const input of inputs) {
    if (input.scope === 'all' || sharedRoles.has(input.role)) {
      for (const shot of shots) add(shot.id, input.id);
      continue;
    }
    if (shots.some((shot) => shot.id === input.scope)) {
      add(input.scope, input.id);
      continue;
    }
    const label = searchableLabel(input.label);
    const peers = groups.get(input.role || 'reference') || [input];
    const together = input.role === 'identity' && peers.length > 1
      ? shots.filter((shot) => togetherPattern.test(String(shot.visibleAction || '')))
      : [];
    for (const shot of together) add(shot.id, input.id);
    const namedMatches = label.length > 1
      ? shots.filter((shot) => String(shot.visibleAction || '').toLowerCase().includes(label))
      : [];
    if (namedMatches.length) {
      for (const shot of namedMatches) add(shot.id, input.id);
      continue;
    }
    if (peers.length === 1) {
      for (const shot of shots) add(shot.id, input.id);
      continue;
    }
    const index = peers.findIndex((item) => item.id === input.id);
    const target = shots[index % Math.max(1, shots.length)];
    if (target) add(target.id, input.id);
  }
  return assignments;
}

function quoteReferenceOptions(model, assignedInputs) {
  const options = {};
  const images = assignedInputs.filter((input) => input.kind === 'image').map((_, index) => `asset:quote-image-${index + 1}`);
  const videos = assignedInputs.filter((input) => input.kind === 'video').map((_, index) => `asset:quote-video-${index + 1}`);
  const audio = assignedInputs.filter((input) => input.kind === 'audio').map((_, index) => `asset:quote-audio-${index + 1}`);
  if (model.fields.includes('image_urls')) options.image_urls = images;
  if (model.fields.includes('image_url')) options.image_url = images[0];
  if (model.fields.includes('start_image_url')) options.start_image_url = images[0];
  if (model.fields.includes('end_image_url') && images[1]) options.end_image_url = images[1];
  if (model.fields.includes('video_urls')) options.video_urls = videos;
  if (model.fields.includes('video_url')) options.video_url = videos[0];
  if (model.fields.includes('audio_urls')) options.audio_urls = audio;
  if (model.fields.includes('audio_url')) options.audio_url = audio[0];
  return options;
}

function planFor(brief, inputs = []) {
  const normalizedBrief = normalizeBrief(brief);
  const duration = normalizedBrief.durationSec;
  const aspectRatio = normalizedBrief.aspectRatio;
  const shots = proposalShotPlan(normalizedBrief);
  for (const input of inputs) {
    if (/^beat-\d+$/.test(input.scope) && !shots.some((shot) => shot.id === input.scope))
      fail(`${input.label} is assigned to a shot that is not in the current plan. Choose automatic mapping or rebuild the assignment.`, 409);
  }
  const referenceAssignments = assignReferencesToShots(inputs, shots);
  const inputById = new Map(inputs.map((input) => [input.id, input]));
  const shotCount = shots.length;
  const videoCalls = shotCount;
  const manifest = inputManifest(inputs);
  const language = /[\u0590-\u05ff]/.test(brief) ? 'he' : 'en';
  const requestsH3 = /(?:minimax|mini[ -]?max|h3|max turbo|מינימאקס)/i.test(brief);
  const requestsFastCheap = /(?:cheap|lower[ -]?cost|budget|turbo|cost[ -]?efficient|זול|חסכ|תקציב)/i.test(brief);
  const requestsFidelity = /(?:best quality|highest quality|premium|maximum quality|איכות (?:הכי )?גבוהה|פרימיום)/i.test(brief);
  const routesByShot = new Map();
  const routeOptionsByShot = new Map();
  const allRouting = new Map();
  const routeChoicesByShot = new Map();
  for (const shot of shots) {
    const assignment = referenceAssignments.find((item) => item.shotId === shot.id);
    const assignedInputs = (assignment?.inputIds || []).map((id) => inputById.get(id)).filter(Boolean);
    let candidates = recommendModels({ task: 'video', inputs: assignedInputs, language, duration: shot.durationSec })
      .filter((candidate) => normalizedBrief.audioPreference !== 'silent' || !getModel(candidate.id).capabilities?.nativeAudioAlways);
    const identityImages = assignedInputs.filter((input) => input.kind === 'image' && input.role === 'identity');
    // image_url + end_image_url are a first/last-frame pair, not two
    // independent character identities. Multiple people require a true
    // multi-reference endpoint so the second face is never misread as an end
    // frame and morphed into the first.
    if (identityImages.length > 1)
      candidates = candidates.filter((candidate) => getModel(candidate.id).fields.includes('image_urls'));
    if (normalizedBrief.audioPreference === 'speech' && language === 'en')
      candidates = candidates.filter((candidate) => getModel(candidate.id).capabilities?.nativeAudio);
    for (const candidate of candidates) allRouting.set(candidate.id, candidate);
    const hasImage = assignedInputs.some((input) => input.kind === 'image');
    const priced = candidates.map((candidate) => {
      const candidateModel = getModel(candidate.id);
      try {
        const economicalResolution = requestsFastCheap && candidateModel.capabilities?.resolutions?.[0];
        const options = { ...candidateModel.defaults, ...(economicalResolution ? { resolution: economicalResolution } : {}), duration: supportedDuration(candidateModel, shot.durationSec), aspect_ratio: aspectRatio };
        Object.assign(options, quoteReferenceOptions(candidateModel, assignedInputs));
        const cost = estimate(candidateModel, buildInput(candidateModel, 'Cinematic shot', options));
        return { ...candidate, estimatedShotCost: cost, generationOptions: options };
      } catch { return { ...candidate, estimatedShotCost: null }; }
    }).filter((candidate) => candidate.estimatedShotCost != null)
      .sort((a, b) => a.estimatedShotCost - b.estimatedShotCost);
    routeChoicesByShot.set(shot.id, priced);
    const h3Route = assignedInputs.length > 1
      ? 'minimax/h3-max/reference-to-video'
      : `minimax/${requestsFastCheap ? 'h3-max-turbo' : 'h3-max'}/${hasImage ? 'image-to-video' : 'text-to-video'}`;
    const preferred = requestsH3 && normalizedBrief.audioPreference !== 'silent'
      ? priced.find((candidate) => candidate.id === h3Route)
      : requestsFidelity
        ? priced.find((candidate) => candidate.id === 'bytedance/seedance-2.5/reference-to-video')
        : priced[0];
    const modelId = preferred?.id || priced[0]?.id || candidates[0]?.id || VIDEO_MODEL;
    routesByShot.set(shot.id, modelId);
    routeOptionsByShot.set(shot.id, priced.find((candidate) => candidate.id === modelId)?.generationOptions || {});
  }
  const selectedVideo = routesByShot.get(shots[0]?.id) || VIDEO_MODEL;
  const commonRouteIds = shots.length ? [...new Set((routeChoicesByShot.get(shots[0].id) || []).map((item) => item.id))]
    .filter((id) => shots.every((shot) => (routeChoicesByShot.get(shot.id) || []).some((item) => item.id === id))) : [];
  const productionOptions = commonRouteIds.map((id) => {
    const route = getModel(id);
    const firstChoice = (routeChoicesByShot.get(shots[0].id) || []).find((item) => item.id === id);
    const cost = shots.reduce((sum, shot) => sum + (routeChoicesByShot.get(shot.id) || []).find((item) => item.id === id).estimatedShotCost, 0);
    return { modelId: id, modelName: route.name, calls: shotCount, estimatedCost: Number(cost.toFixed(4)), selected: [...routesByShot.values()].every((selected) => selected === id), resolution: firstChoice?.generationOptions?.resolution || route.defaults.resolution || null, nativeAudio: !!route.capabilities?.nativeAudio };
  }).sort((a, b) => a.estimatedCost - b.estimatedCost).slice(0, 5);
  const requiresKeyframe = [...routesByShot.values()].some((modelId) => getModel(modelId).fields.some((field) => ['image_url', 'start_image_url', 'image_urls'].includes(field)));
  const imageCalls = 0;
  const nativeDialogue = normalizedBrief.audioPreference === 'speech' && language === 'en' &&
    [...routesByShot.values()].every((modelId) => getModel(modelId).capabilities?.nativeAudio);
  const speechCalls = normalizedBrief.audioPreference === 'speech' && !nativeDialogue ? shotCount : 0;
  const costByModel = new Map();
  const videoCost = shots.reduce((total, shot) => {
    const assignment = referenceAssignments.find((item) => item.shotId === shot.id);
    const assignedInputs = (assignment?.inputIds || []).map((id) => inputById.get(id)).filter(Boolean);
    const shotModel = getModel(routesByShot.get(shot.id));
    const options = { ...shotModel.defaults, ...(routeOptionsByShot.get(shot.id) || {}), duration: supportedDuration(shotModel, shot.durationSec), aspect_ratio: aspectRatio };
    Object.assign(options, quoteReferenceOptions(shotModel, assignedInputs));
    const sample = buildInput(shotModel, 'Cinematic shot', options);
    const cost = estimate(shotModel, sample);
    if (cost == null) fail(`Live pricing is unavailable for ${shotModel.name}. Choose a model with verified pricing before authorizing production.`, 409);
    const current = costByModel.get(shotModel.id) || { modelId: shotModel.id, modelName: shotModel.name, calls: 0, seconds: 0, cost: 0, shots: [] };
    current.calls += 1;
    current.seconds += shot.durationSec;
    current.cost = Number((current.cost + cost).toFixed(4));
    current.shots.push(shot.id);
    costByModel.set(shotModel.id, current);
    return total + cost;
  }, 0);
  const estimatedCost = Number((videoCost + imageCalls * 0.04 + speechCalls * 0.08).toFixed(4));
  const audioRoute = normalizedBrief.audioPreference === 'silent'
    ? 'silent'
    : nativeDialogue ? 'native_dialogue'
    : speechCalls ? 'separate_speech_lipsync' : 'native_ambience';
  const plan = {
    schemaVersion: 1,
    brief: normalizedBrief,
    shots,
    duration,
    aspectRatio,
    shotCount,
    cameraLanguage: 'מספרי קולנוע: establishing, medium, close-up, over-the-shoulder, motivated movement, matched eyelines and screen direction.',
    continuity: ['זהות דמויות נעולה', 'מלתחה ואביזרים נשמרים בין שוטים', 'לוקיישן ותאורה מקבלים reference pack', 'פריים סיום של כל שוט נבדק מול הבא'],
    audioRoute,
    audioPlan: { route: audioRoute, language: normalizedBrief.language, originalAudioPolicy: audioRoute === 'silent' ? 'mute_all' : speechCalls ? 'mute_native_dialogue' : nativeDialogue ? 'native_dialogue_single_path' : 'native_ambience_only', musicPolicy: audioRoute === 'silent' ? 'none' : 'global_after_picture_lock' },
    audio: audioRoute === 'silent' ? 'הסרט ייווצר ללא שמע; כל אודיו מובנה יושתק בייצוא.' : speechCalls ? 'קול דיבור נפרד → בדיקת טקסט → lip-sync → mix יחיד ללא כפילות; native dialogue כבוי. מוזיקה מתווספת פעם אחת בלבד אחרי נעילת העריכה.' : nativeDialogue ? 'דיאלוג אנגלי ואווירה נוצרים יחד בווידאו במסלול שמע יחיד, עם הטקסט המדויק בפרומפט. מוזיקה מתווספת פעם אחת בלבד אחרי נעילת העריכה.' : 'כל שוט מקבל רק אווירה, room tone, foley ואפקטים. מוזיקה נוצרת פעם אחת בלבד לכל הסרט אחרי נעילת העריכה.',
    models: { planning: 'google/gemini-2.5-flash', assets: IMAGE_MODEL, video: selectedVideo, videoByShot: Object.fromEntries(routesByShot), voice: speechCalls ? VOICE_MODEL : null },
    routePlan: { videoModel: selectedVideo, videoModelsByShot: Object.fromEntries(routesByShot), videoOptionsByShot: Object.fromEntries(routeOptionsByShot), inputManifest: manifest, requiresImageKeyframe: requiresKeyframe, selectionPolicy: requestsFidelity ? 'fidelity' : requestsFastCheap ? 'economy' : 'best-value', options: productionOptions },
    referenceAssignments: referenceAssignments.map((assignment) => ({
      ...assignment,
      references: assignment.inputIds.map((id) => {
        const input = inputById.get(id);
        return { id, kind: input?.kind, role: input?.role, label: input?.label };
      }),
    })),
    calls: { planning: 1, assets: imageCalls, video: videoCalls, speech: speechCalls, qc: shotCount + 2, total: 1 + imageCalls + videoCalls + speechCalls + shotCount + 2 },
    estimatedCost,
    costBreakdown: {
      media: [...costByModel.values()],
      planning: [{ modelId: 'google/gemini-2.5-flash', calls: 1, cost: 0, included: true }],
      qualityChecks: { calls: shotCount + 2, cost: 0, included: true },
      totalPaidEstimate: estimatedCost,
    },
    autoDefaults: true,
    inputManifest: manifest,
    routing: [...allRouting.values()].sort((a, b) => b.score - a.score).slice(0, 6),
  };
  validateProposal(plan);
  return { ...plan, quote: quoteForPlan(plan) };
}

function planHash(plan, brief, inputs = []) {
  return stableHash({ brief, plan, inputs });
}

function allowedActions(film, state) {
  const run = [...(state.runs || [])].at(-1);
  const proposal = [...(state.plans || [])].at(-1);
  if (!run) return proposal ? ['authorize', 'edit_brief', 'attach_reference'] : ['plan', 'attach_reference'];
  if (['queued', 'generating', 'awaiting_media', 'awaiting_qc'].includes(run.status)) return ['view_progress', 'pause', 'open_advanced'];
  if (run.status === 'paused') return ['resume', 'cancel', 'open_advanced'];
  if (run.status === 'completed') return ['download', 'request_change', 'open_advanced'];
  if (run.status === 'needs_attention') return ['review', 'request_change', 'open_advanced'];
  if (run.status === 'failed') return ['retry', 'edit_brief', 'open_advanced'];
  if (run.status === 'cancelled' && proposal?.status === 'planning') return ['authorize', 'edit_brief', 'attach_reference', 'open_advanced'];
  return ['view_progress', 'open_advanced'];
}

export function concierge(id, body = {}) {
  const brief = required(body.brief, 'Creative brief', 12000);
  const current = getFilm(id);
  const inputs = validateInputs(current, Array.isArray(body.inputs) ? body.inputs : []);
  const plan = planFor(brief, inputs);
  if (body.mode && !['plan', 'authorize'].includes(body.mode))
    fail('Director Chat accepts only plan or authorize mode.', 400);
  const mode = body.mode === 'authorize' ? 'authorize' : 'planning';
  const idempotencyKey = String(body.idempotencyKey || '').trim();
  if (current.rehearsalOnly && mode !== 'planning') required('', 'A live project for paid production');
  current.concierge ||= { messages: [], plans: [], runs: [] };
  if (mode === 'authorize') {
    const previous = current.concierge.runs.find((r) => r.idempotencyKey === idempotencyKey);
    if (previous) return { plan: previous.plan, planHash: previous.planHash, status: previous.status, runId: previous.id, filmId: id, alreadyStarted: true };
    const proposal = current.concierge.plans.find((p) => p.id === body.planId && p.status === 'planning');
    if (!proposal || proposal.brief !== brief)
      required('', 'An approved proposal is required before authorizing production.');
    if (!idempotencyKey) required('', 'Generation token');
  }
  const proposalId = mode === 'planning' ? crypto.randomUUID() : body.planId;
  const approvedProposal = mode === 'authorize' ? current.concierge.plans.find((p) => p.id === proposalId) : null;
  const committedPlan = approvedProposal?.plan || plan;
  const committedInputs = approvedProposal?.inputs || inputs;
  const committedPlanHash = approvedProposal?.planHash || planHash(committedPlan, brief, committedInputs);
  if (mode === 'authorize' && committedPlan.audioRoute === 'separate_speech_lipsync')
    fail('Automatic speech and lip-sync are not yet wired into the unattended runner. Use the guided workflow until that preflight path is complete.', 409);
  if (mode === 'authorize' && committedPlan.routePlan?.requiresImageKeyframe && !committedPlan.inputManifest?.hasImage)
    fail('This route requires a keyframe, but unattended keyframe generation is not wired yet. Attach an approved image or choose a text-to-video model.', 409);
  const authorization = mode === 'authorize'
    ? authorizationForQuote(committedPlan.quote, body.budgetCap ?? committedPlan.quote.cap)
    : null;
  const film = mutate(id, mode === 'authorize' ? 'concierge.authorized' : 'concierge.planned', (f) => {
    f.concierge ||= { messages: [], plans: [], runs: [] };
    f.concierge.messages.push({ id: crypto.randomUUID(), role: 'user', text: brief, inputIds: committedInputs.map((input) => input.id).filter(Boolean), relatedProposalId: proposalId, at: now() });
    if (mode === 'planning') f.concierge.plans.push({ id: proposalId, brief, inputs, plan, planHash: committedPlanHash, status: mode, createdAt: now() });
    if (mode === 'authorize') {
      const proposal = f.concierge.plans.find((item) => item.id === proposalId && item.status === 'planning');
      if (!proposal) fail('This proposal was already used. Build a new plan before starting another paid run.', 409);
      const runId = crypto.randomUUID();
      for (const previousRun of f.concierge.runs) {
        if (!previousRun.supersededAt) {
          previousRun.supersededAt = now();
          previousRun.supersededByRunId = runId;
        }
      }
      f.concierge.activeRunId = runId;
      proposal.status = 'authorized';
      proposal.authorizedRunId = runId;
      proposal.authorizedAt = now();
      f.concierge.runs.push({ id: runId, idempotencyKey, proposalId, brief, inputs: committedInputs, plan: committedPlan, planHash: committedPlanHash, quote: committedPlan.quote, budget: authorization, status: 'queued', createdAt: now() });
    }
    return { plan: committedPlan, status: mode, filmId: f.id, planHash: committedPlanHash };
  });
  const run = mode === 'authorize' ? film.concierge.runs.at(-1) : null;
  return { film: getFilm(id), plan: committedPlan, planHash: committedPlanHash, proposalId, status: mode, runId: run?.id || null, filmId: film.id };
}

export function conciergeState(id) {
  const f = getFilm(id);
  const state = f.concierge || { messages: [], plans: [], runs: [] };
  return { ...state, activeRun: [...(state.runs || [])].at(-1) || null, allowedActions: allowedActions(f, state), revision: f.revision };
}

export function saveConciergeDraft(id, body = {}) {
  const text = typeof body.text === 'string' ? body.text.slice(0, 12000) : '';
  const requested = Array.isArray(body.attachments)
    ? body.attachments
    : Array.isArray(body.attachmentIds) ? body.attachmentIds.map((attachmentId) => ({ id: attachmentId })) : [];
  return mutate(id, 'concierge.draft_saved', (film) => {
    film.concierge ||= { messages: [], plans: [], runs: [] };
    const seen = new Set();
    const attachments = requested.slice(0, 30).flatMap((item) => {
      const id = typeof item?.id === 'string' ? item.id : '';
      const version = film.versions.find((candidate) => candidate.id === id);
      if (!id || seen.has(id) || !version?.localPath || version.status === 'rejected') return [];
      seen.add(id);
      const scope = String(item.scope || 'auto');
      return [{
        id, kind: version.kind, label: version.label || version.input?.filename || `${version.kind} reference`,
        role: String(item.role || '').slice(0, 40) || (version.kind === 'audio' ? 'dialogue-or-sound' : version.kind === 'video' ? 'performance' : 'identity'),
        scope: ['auto', 'all'].includes(scope) || /^beat-\d+$/.test(scope) ? scope : 'auto', source: 'upload',
      }];
    });
    film.concierge.draft = { text, attachments, attachmentIds: attachments.map((item) => item.id), updatedAt: now() };
    return film.concierge.draft;
  }).concierge.draft;
}

export function conciergeAgentState(id) {
  const f = getFilm(id);
  const state = conciergeState(id);
  const plan = [...(state.plans || [])].at(-1) || null;
  const run = state.activeRun;
  return {
    filmId: f.id,
    revision: f.revision,
    proposal: plan ? { id: plan.id, status: plan.status, planHash: plan.planHash, duration: plan.plan.duration, aspectRatio: plan.plan.aspectRatio, estimatedCost: plan.plan.estimatedCost } : null,
    run: run ? { id: run.id, status: run.status, progress: run.progress || null, nextAction: run.nextAction || null, planHash: run.planHash } : null,
    allowedActions: state.allowedActions,
    blockers: run?.status === 'failed' && run.error ? [run.error] : [],
  };
}

export function runAction(id, runId, body = {}) {
  const action = String(body.action || '');
  if (!['pause', 'resume', 'cancel', 'retry'].includes(action)) required('', 'Run action');
  const retryTaskIds = [];
  const result = mutate(id, `concierge.run_${action}`, (film) => {
    const run = film.concierge?.runs?.find((item) => item.id === runId);
    if (!run) required('', 'Production run');
    if (action === 'pause') {
      if (!['queued', 'generating', 'awaiting_media', 'awaiting_qc'].includes(run.status))
        required('', 'A running production');
      run.status = 'paused';
      run.pausedAt = now();
      run.nextAction = 'Production is paused. Resume to submit remaining work.';
    }
    if (action === 'resume') {
      if (run.status !== 'paused') required('', 'A paused production');
      run.status = 'queued';
      run.resumedAt = now();
      run.nextAction = 'Production will resume from the first unfinished task.';
    }
    if (action === 'cancel') {
      if (['completed', 'cancelled'].includes(run.status)) required('', 'An active production');
      const versions = (run.versionIds || []).map((versionId) => film.versions.find((version) => version.id === versionId)).filter(Boolean);
      for (const reservation of run.budget?.reservations || []) {
        const shotId = reservation.taskId.startsWith('video:') ? reservation.taskId.slice(6) : null;
        const version = shotId ? versions.find((item) => item.shotId === shotId) : null;
        if (reservation.status === 'reserved' && (!version || (version.status === 'failed' && !version.requestId))) {
          reservation.status = 'released';
          reservation.reason = 'cancelled_before_provider_submission';
          run.budget.reserved = Math.round((run.budget.reserved - reservation.amount) * 10000) / 10000;
        }
      }
      run.status = 'cancelled';
      run.cancelledAt = now();
      run.nextAction = 'Production cancelled. Existing media and history remain available.';
    }
    if (action === 'retry') {
      if (run.status !== 'failed') required('', 'A failed production');
      const failed = (run.versionIds || [])
        .map((versionId) => film.versions.find((version) => version.id === versionId))
        .filter((version) => version && version.status === 'failed' && !version.requestId);
      if (!failed.length)
        fail('This failure cannot be retried safely because provider submission may have occurred. Open the production workspace to reconcile it.', 409);
      const unsafe = (run.versionIds || [])
        .map((versionId) => film.versions.find((version) => version.id === versionId))
        .some((version) => version && ['submission_unknown', 'queued', 'running'].includes(version.status));
      if (unsafe)
        fail('Wait for or reconcile the existing provider request before retrying.', 409);
      for (const version of failed) {
        version.previousIdempotencyKey = version.idempotencyKey || null;
        delete version.idempotencyKey;
        retryTaskIds.push(`video:${version.shotId}`);
      }
      for (const reservation of run.budget?.reservations || []) {
        if (retryTaskIds.includes(reservation.taskId) && reservation.status === 'reserved') {
          reservation.status = 'released';
          reservation.reason = 'safe_retry_before_provider_submission';
          run.budget.reserved = Math.round((run.budget.reserved - reservation.amount) * 10000) / 10000;
        }
      }
      run.versionIds = (run.versionIds || []).filter((versionId) => !failed.some((version) => version.id === versionId));
      run.status = 'generating';
      run.error = null;
      run.retriedAt = now();
      run.nextAction = 'Retrying only media that failed before provider submission.';
    }
    return { runId, status: run.status, action };
  });
  if (action === 'retry') {
    for (const taskId of retryTaskIds)
      transitionDirectorTask(id, runId, taskId, 'ready', { error: null, leaseOwner: null, leaseUntil: null, outputVersionIds: [] });
  }
  return result;
}
