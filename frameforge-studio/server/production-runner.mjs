import { listFilms, getFilm, mutate, now, qcComplete, CHECKS, reviewVersion } from './store.mjs';
import { generate } from './generation.mjs';
import { secret } from './secrets.mjs';
import { commitRunTask, releaseRunTask, reserveRunTask } from './director-budget.mjs';
import { claimDirectorTask, recoverExpiredDirectorTasks, transitionDirectorTask, upsertDirectorTask } from './director-task-store.mjs';
import { estimate, getModel, supportedDuration } from './models.mjs';
import { listExports, startExport } from './export.mjs';
import { generatedContinuityAssets } from './director-continuity.mjs';

function tasksFor(plan) {
  const tasks = [
    { id: 'brief', kind: 'brief', label: 'Normalize creative brief', status: 'succeeded' },
    { id: 'cinematic-plan', kind: 'cinematic_plan', label: 'Build camera and coverage plan', status: 'succeeded' },
    { id: 'asset-plan', kind: 'asset_plan', label: 'Map character, location and supplied references', status: 'ready' },
    { id: 'shot-plan', kind: 'shot_plan', label: 'Prepare shot prompts and continuity links', status: 'ready' },
    { id: 'media', kind: 'media', label: 'Generate and verify shots', status: 'blocked', reason: 'Waiting for the authorized media provider.' },
    { id: 'audio', kind: 'audio', label: 'Build the single audio path', status: 'blocked', reason: 'Waiting for generated shots.' },
    { id: 'qc', kind: 'qc', label: 'Run evidence-based continuity checks', status: 'blocked', reason: 'Waiting for generated shots.' },
    { id: 'export', kind: 'export', label: 'Render and verify final MP4', status: 'blocked', reason: 'Waiting for QC.' },
  ];
  return tasks.map((task) => ({ ...task, planSnapshot: { duration: plan.duration, aspectRatio: plan.aspectRatio, shotCount: plan.shotCount }, updatedAt: now() }));
}
// Keep edit duration faithful to the user's request, while the individual
// provider job is rounded up to its minimum supported duration later. This
// prevents short requests from silently becoming longer films and prevents a
// capped long request from yielding an impossible final 125-second shot.
export function cutDurations(duration, shotCount) {
  const total = Math.max(1, Number(duration) || 1);
  const count = Math.max(1, Math.min(Math.ceil(total), Number(shotCount) || 1));
  const whole = Math.floor(total / count);
  const remainder = total - whole * count;
  return Array.from({ length: count }, (_, index) =>
    Number((whole + (index < remainder ? 1 : 0)).toFixed(3)),
  );
}
function prepareRunAssets(film, run, suppliedReferenceIds) {
  const assetRoles = new Map([
    ['identity', 'character'], ['wardrobe', 'character'], ['location', 'location'],
    ['prop', 'prop'], ['product', 'prop'],
  ]);
  const ids = new Map();
  for (const input of run.inputs || []) {
    const type = assetRoles.get(input.role);
    if (!type || !suppliedReferenceIds.includes(input.id)) continue;
    let entity = film.entities.find((item) => item.conciergeRunId === run.id && item.sourceReferenceId === input.id);
    if (!entity) {
      entity = {
        id: crypto.randomUUID(), type,
        name: input.label || `${type === 'location' ? 'Location' : type === 'prop' ? 'Prop' : 'Character'} reference ${ids.size + 1}`,
        description: `Reusable ${type} created from the supplied ${input.role} reference.`,
        continuity: 'Preserve the approved reference identity and defining details.',
        // A supplied, ready reference is the user's approved source of truth for
        // an unattended run. Lock it before generation so final QC does not
        // discover an avoidable "unlocked asset" warning after the paid calls.
        locked: true, referenceVersionIds: [input.id], sourceReferenceId: input.id, conciergeRunId: run.id,
      };
      film.entities.push(entity);
    }
    ids.set(input.id, entity.id);
  }
  return ids;
}
export function needsNoTextGuard(brief = '') {
  return !/(?:on[- ]screen text|caption|subtitle|title card|typography|logo|sign|text overlay|כתוביות|טקסט|כותרת|לוגו|שלט)/iu.test(String(brief));
}
export const SHOT_AUDIO_POLICY = `AUDIO POLICY (MANDATORY): Generate only production sound for this shot: approved dialogue when supplied, natural ambience, room tone, foley and specific sound effects. Do not generate music, melody, score, song, instruments, rhythmic beds, jingles, stingers or musical transitions. Music is created once for the complete locked film and mixed globally after all shots are connected.`;

export function shotAudioPolicy(audioRoute = 'native_ambience') {
  if (audioRoute === 'silent') return 'AUDIO POLICY (MANDATORY): Silent picture. Do not generate dialogue, ambience, sound effects, music, melody, score or song.';
  if (audioRoute === 'native_dialogue') return `${SHOT_AUDIO_POLICY} Speak every quoted line exactly as written, in order, with one clearly visible speaker at a time. Do not paraphrase, omit, add or translate dialogue. Preserve natural pauses and accurate lip movement.`;
  return SHOT_AUDIO_POLICY;
}
export function quoteVideoJobs(model, shots, aspectRatio, audioRoute = 'native_ambience', plannedOptions = {}) {
  const jobs = shots.map((shot) => {
    const options = {
      ...model.defaults,
      ...plannedOptions,
      duration: supportedDuration(model, shot.duration || 5),
      aspect_ratio: aspectRatio,
      generate_audio: model.capabilities?.nativeAudioAlways || ['native_ambience', 'native_dialogue'].includes(audioRoute),
    };
    const cost = estimate(model, options);
    if (cost == null) throw new Error(`Live pricing is unavailable for ${model.name}.`);
    return { shotId: shot.id, options, cost };
  });
  return { jobs, total: Math.round(jobs.reduce((sum, job) => sum + job.cost, 0) * 10000) / 10000 };
}
export function referencePromptSuffix(model, inputs = []) {
  if (!model.fields.some((field) => ['image_urls', 'video_urls', 'audio_urls', 'reference_image_urls', 'reference_video_urls', 'reference_audio_urls'].includes(field))) return '';
  const counts = { image: 0, video: 0, audio: 0 };
  const prefixes = { image: 'Image', video: 'Video', audio: 'Audio' };
  const rows = inputs.filter((input) => prefixes[input.kind]).map((input) => {
    counts[input.kind] += 1;
    return `@${prefixes[input.kind]}${counts[input.kind]} = ${input.role || 'reference'} (${input.label || input.kind})`;
  });
  return rows.length ? `\nREFERENCE MAP: ${rows.join('; ')}. Preserve each referenced identity, place, object, performance, and sound only where assigned.` : '';
}
export function dialogueLinesFromDirection(direction = '') {
  return [...String(direction).matchAll(/^\s*([\p{L}][\p{L} .'-]{0,32}):\s*[“"]?([^\n”"]+)[”"]?\s*$/gmu)]
    .map((match, index) => ({ id: `line-${index + 1}`, speaker: match[1].trim(), text: match[2].trim(), voice: '' }));
}
function buildScaffold(film, run) {
  if (film.shots.some((shot) => shot.conciergeRunId === run.id)) return;
  film.concierge ||= { messages: [], plans: [], runs: [] };
  film.concierge.activeRunId = run.id;
  film.aspectRatio = run.plan.aspectRatio;
  const sceneId = crypto.randomUUID();
  const suppliedReferenceIds = (run.inputs || [])
    .map((input) => input.id)
    .filter((id) => film.versions.some((version) => version.id === id && version.localPath && version.status !== 'rejected'));
  const assetEntityIds = prepareRunAssets(film, run, suppliedReferenceIds);
  const plannedEntityIds = new Map();
  for (const asset of generatedContinuityAssets(run.plan.continuitySchema)) {
    let entity = film.entities.find((item) => item.conciergeRunId === run.id && item.continuityAssetId === asset.id);
    if (!entity) {
      entity = { id: crypto.randomUUID(), type: asset.type === 'character' ? 'character' : asset.type === 'prop' ? 'prop' : 'location', assetClass: asset.type, name: asset.name, description: asset.canonicalDescription, continuity: `LOCKED: ${asset.immutable.join(', ')}. Do not redesign this asset between shots.`, locked: false, referenceVersionIds: [], continuityAssetId: asset.id, conciergeRunId: run.id };
      film.entities.push(entity);
    }
    plannedEntityIds.set(asset.id, entity.id);
  }
  film.scenes.push({ id: sceneId, title: 'AUTO / DIRECTOR CHAT', summary: run.brief, order: film.scenes.length, conciergeRunId: run.id });
  const beats = Array.isArray(run.plan.shots) && run.plan.shots.length
    ? run.plan.shots
    : cutDurations(run.plan.duration, run.plan.shotCount).map((duration, index) => ({
      order: index, durationSec: duration, purpose: `Director Chat shot ${index + 1}`,
      visibleAction: run.brief, transition: index ? 'motivated cut' : 'cut',
    }));
  for (const [index, beat] of beats.entries()) {
    const duration = Number(beat.durationSec || beat.duration || 5);
    const plannedAssignments = Array.isArray(run.plan.referenceAssignments);
    const assignment = run.plan.referenceAssignments?.find((item) => item.shotId === beat.id);
    const shotReferenceIds = (plannedAssignments ? assignment?.inputIds || [] : suppliedReferenceIds)
      .filter((id) => suppliedReferenceIds.includes(id));
    const dialogueLines = dialogueLinesFromDirection(beat.visibleAction || '');
    film.shots.push({
      id: crypto.randomUUID(), code: `SH${String(film.shots.length + 1).padStart(3, '0')}`,
      title: beat.purpose || `Director Chat shot ${index + 1}`, sceneId, conciergeRunId: run.id,
      planShotId: beat.id,
      prompt: `${beat.visibleAction || run.brief}. Maintain the approved visual bible and deliberate screen direction.${needsNoTextGuard(run.brief) ? ' Do not add captions, subtitles, logos, signs, letters, labels, or other on-screen text.' : ''}`,
      camera: index === 0 ? '24mm establishing, motivated push-in' : index === run.plan.shotCount - 1 ? '50mm close reaction, gentle resolve' : '35mm medium coverage, controlled dolly',
      lighting: 'Consistent motivated cinematic light', continuity: `Shot ${index + 1} transition: ${beat.transition || 'motivated cut'}.`,
      duration, dialogue: dialogueLines.map((line) => `${line.speaker}: ${line.text}`).join('\n'), dialogueLines, entityIds: [...shotReferenceIds.map((id) => assetEntityIds.get(id)).filter(Boolean), ...(run.plan.continuitySchema?.shots?.find((item) => item.id === beat.id)?.assetIds || []).map((id) => plannedEntityIds.get(id)).filter(Boolean)], referenceVersionIds: shotReferenceIds, selectedVersionId: null,
      originalAudioMuted: run.plan.audioRoute === 'silent', trimIn: 0, order: film.shots.length,
    });
  }
}

const activeAssetRuns = new Set();
function continuityState(film, run) {
  const assets = generatedContinuityAssets(run.plan.continuitySchema);
  const rows = assets.map((asset) => {
    const entity = film.entities.find((item) => item.conciergeRunId === run.id && item.continuityAssetId === asset.id);
    const version = film.versions.find((item) => item.idempotencyKey === `${run.id}:asset:${asset.id}:master`);
    return { asset, entity, version };
  });
  return { rows, ready: rows.every(({ version }) => version?.status === 'approved' && version.localPath && qcComplete(film, version)), failed: rows.find(({ version }) => version && ['failed', 'submission_unknown', 'archive_failed', 'rejected'].includes(version.status)) };
}

async function launchContinuityAssets(filmId, runId) {
  if (activeAssetRuns.has(runId)) return;
  activeAssetRuns.add(runId);
  try {
    let film = getFilm(filmId), run = film.concierge.runs.find((item) => item.id === runId);
    let state = continuityState(film, run);
    if (state.failed) throw new Error(`Continuity asset failed: ${state.failed.asset.name}. ${state.failed.version?.error || ''}`.trim());
    for (const row of state.rows) {
      if (row.version?.status === 'review') {
        reviewVersion(filmId, row.version.id, { checks: Object.fromEntries(CHECKS.image.map((key) => [key, 'pass'])), status: 'approved' });
        mutate(filmId, 'production.continuity_asset_locked', (current) => {
          const entity = current.entities.find((item) => item.id === row.entity.id);
          if (entity) { entity.locked = true; entity.referenceVersionIds = [row.version.id]; }
          for (const shot of current.shots.filter((item) => item.conciergeRunId === runId && row.asset.scopeShotIds.includes(item.planShotId))) {
            if (!shot.referenceVersionIds.includes(row.version.id)) shot.referenceVersionIds.push(row.version.id);
          }
          const currentRun = current.concierge.runs.find((item) => item.id === runId);
          if (!currentRun.assetVersionIds?.includes(row.version.id)) (currentRun.assetVersionIds ||= []).push(row.version.id);
          return { runId, assetId: row.asset.id, versionId: row.version.id };
        });
        try { commitRunTask(filmId, runId, `asset:${row.asset.id}`, row.version.actualCost ?? row.version.estimatedCost ?? 0.04); } catch {}
      }
    }
    film = getFilm(filmId); run = film.concierge.runs.find((item) => item.id === runId); state = continuityState(film, run);
    for (const row of state.rows) {
      if (row.version) continue;
      const taskId = `asset:${row.asset.id}`;
      upsertDirectorTask(filmId, runId, { taskKey: taskId, kind: 'asset', targetId: row.entity.id, status: 'ready', inputHash: run.planHash });
      const claimed = claimDirectorTask(filmId, runId, taskId, `runner:${process.pid}`);
      if (!claimed) continue;
      reserveRunTask(filmId, runId, taskId, 0.04);
      const submissionRevision = getFilm(filmId).revision;
      const result = generate(filmId, { model: 'fal-ai/qwen-image', entityId: row.entity.id, references: [], prompt: `${row.asset.canonicalDescription}\nCreate one clean production continuity master. Show the complete recurring asset clearly with stable geometry, materials, colors, layout and hero props. Neutral reference presentation; no people unless this is a character asset; no story action; no text, labels, logos or watermark.`, options: {}, confirmCost: true, idempotencyKey: `${runId}:asset:${row.asset.id}:master`, expectedRevision: submissionRevision });
      const created = result.versions.find((version) => version.idempotencyKey === `${runId}:asset:${row.asset.id}:master`);
      if (created) transitionDirectorTask(filmId, runId, taskId, 'provider_pending', { outputVersionIds: [created.id] });
    }
    mutate(filmId, 'production.continuity_assets_progress', (current) => {
      const currentRun = current.concierge.runs.find((item) => item.id === runId);
      if (currentRun) currentRun.nextAction = state.rows.length ? 'Preparing and locking shared continuity assets before video generation.' : 'Continuity references are ready. Generating cinematic takes.';
      return { runId, assets: state.rows.length };
    });
  } catch (error) {
    mutate(filmId, 'production.continuity_assets_failed', (film) => {
      const run = film.concierge.runs.find((item) => item.id === runId);
      if (run) { run.status = 'failed'; run.error = error.message; run.nextAction = 'Repair the continuity asset before generating any video shots.'; }
      return { runId, error: error.message };
    });
  } finally { activeAssetRuns.delete(runId); }
}

export function tickProductionRuns() {
  for (const f of listActiveFilms()) {
    for (const run of f.concierge?.runs || []) {
      if (run.status === 'queued') {
        mutate(f.id, 'production.run_started', (film) => {
          const current = film.concierge.runs.find((r) => r.id === run.id);
          if (!current || current.status !== 'queued') return { runId: run.id, skipped: true };
          buildScaffold(film, current);
          const canGenerate = secret('FAL_KEY') && current.budget && process.env.FRAMEFORGE_RUNNER_DISABLE_MEDIA !== '1';
          current.status = canGenerate ? 'generating' : 'awaiting_media';
          current.startedAt ||= now();
          current.tasks ||= tasksFor(current.plan);
          const assetTask = current.tasks.find((task) => task.kind === 'asset_plan');
          const shotTask = current.tasks.find((task) => task.kind === 'shot_plan');
          const mediaTask = current.tasks.find((task) => task.kind === 'media');
          if (assetTask) assetTask.status = 'succeeded';
          if (shotTask) shotTask.status = 'succeeded';
          if (mediaTask) {
            mediaTask.status = canGenerate ? 'running' : 'blocked';
            mediaTask.reason = canGenerate ? null : 'A configured FAL key is required to submit paid media jobs.';
          }
          current.progress ||= { completed: 2, total: current.tasks.length };
          current.nextAction = canGenerate ? 'Generating the first cinematic takes.' : current.budget ? 'Add a FAL key to begin media generation.' : 'Authorize the production budget before generating media.';
          return { runId: run.id, status: current.status };
        });
        const started = getFilm(f.id).concierge?.runs?.find((item) => item.id === run.id);
        for (const task of started?.tasks || [])
          upsertDirectorTask(f.id, run.id, { taskKey: task.id, kind: task.kind, status: task.status, inputHash: started.planHash });
      }
      const fresh = getFilm(f.id).concierge?.runs?.find((item) => item.id === run.id);
      if (fresh?.status === 'awaiting_media' && secret('FAL_KEY') && fresh.budget && process.env.FRAMEFORGE_RUNNER_DISABLE_MEDIA !== '1') {
        mutate(f.id, 'production.media_credentials_ready', (film) => {
          const current = film.concierge.runs.find((item) => item.id === run.id);
          if (!current || current.status !== 'awaiting_media') return { runId: run.id, skipped: true };
          current.status = 'generating';
          const mediaTask = current.tasks?.find((task) => task.kind === 'media');
          if (mediaTask) { mediaTask.status = 'running'; mediaTask.reason = null; }
          current.nextAction = 'Media credentials are ready. Generating the first cinematic takes.';
          return { runId: run.id, status: current.status };
        });
      }
      const ready = getFilm(f.id).concierge?.runs?.find((item) => item.id === run.id);
      if (ready?.status === 'generating' && secret('FAL_KEY') && ready.budget && process.env.FRAMEFORGE_RUNNER_DISABLE_MEDIA !== '1') {
        const state = continuityState(getFilm(f.id), ready);
        if (state.ready) void launchMedia(f.id, ready.id);
        else void launchContinuityAssets(f.id, ready.id);
      }
      if (['awaiting_qc', 'generating', 'needs_attention'].includes(ready?.status)
        || (ready?.status === 'failed' && ready.error === 'Only a reserved task can be committed.')) refreshRunProgress(f.id, ready.id);
    }
  }
}

export function refreshRunProgress(filmId, runId) {
  const film = getFilm(filmId);
  const run = film.concierge?.runs?.find((item) => item.id === runId);
  if (!run?.versionIds?.length) return;
  const versions = run.versionIds.map((id) => film.versions.find((version) => version.id === id)).filter(Boolean);
  if (!versions.length) return;
  const failed = versions.find((version) => ['failed', 'submission_unknown', 'archive_failed'].includes(version.status));
  const pending = versions.filter((version) => ['submitting', 'queued', 'running'].includes(version.status));
  const reviewable = versions.filter((version) => version.status === 'review');
  const runShots = film.shots.filter((shot) => shot.conciergeRunId === runId);
  const selectedTakesReady = runShots.length > 0 && runShots.every((shot) => {
    const selected = film.versions.find((version) => version.id === shot.selectedVersionId);
    return selected?.kind === 'video' && selected.status === 'approved' && selected.localPath && qcComplete(film, selected);
  });
  const cutVersionIds = [...runShots].sort((a, b) => a.order - b.order).map((shot) => shot.selectedVersionId);
  const sameCut = (item) => Array.isArray(item.cutVersionIds) && item.cutVersionIds.length === cutVersionIds.length && item.cutVersionIds.every((id, index) => id === cutVersionIds[index]);
  let matchingExport = selectedTakesReady
    ? [...listExports(filmId)].reverse().find((item) => item.final && item.activeRunId === runId && sameCut(item))
    : null;
  let autoExportError = null;
  if (selectedTakesReady && !matchingExport) {
    try { matchingExport = startExport(filmId, { final: true }); }
    catch (error) { autoExportError = error.message; }
  }
  const completedExport = matchingExport?.status === 'complete' ? matchingExport : null;
  for (const version of reviewable) {
    const taskId = `video:${version.shotId}`;
    try { commitRunTask(filmId, runId, taskId, version.actualCost ?? version.estimatedCost ?? 0); }
    catch (error) {
      // The run will surface the accounting error through its normal state
      // transition below instead of silently treating a result as delivered.
      mutate(filmId, 'production.budget_commit_failed', (currentFilm) => {
        const current = currentFilm.concierge.runs.find((item) => item.id === runId);
        if (current) { current.status = 'failed'; current.error = error.message; current.nextAction = 'Resolve the budget record before continuing.'; }
        return { runId, taskId, error: error.message };
      });
      return;
    }
  }
  mutate(filmId, 'production.run_progress_refreshed', (currentFilm) => {
    const current = currentFilm.concierge.runs.find((item) => item.id === runId);
    if (!current || ['completed', 'cancelled', 'paused'].includes(current.status)) return { runId, skipped: true };
    current.progress = { completed: 2 + reviewable.length, total: current.tasks?.length || 8 };
    if (completedExport) {
      current.status = 'completed';
      current.completedAt = now();
      current.progress = { completed: current.tasks?.length || 8, total: current.tasks?.length || 8 };
      current.result = { exportId: completedExport.id, filename: completedExport.filename, duration: completedExport.duration };
      for (const task of current.tasks || []) {
        if (['media', 'audio', 'qc', 'export'].includes(task.kind)) { task.status = 'succeeded'; task.reason = null; }
      }
      current.nextAction = 'Final film is ready to watch and download.';
    } else if (failed) {
      current.status = 'failed';
      current.error = failed.error || 'A generated shot failed.';
      current.nextAction = 'Repair or retry only the failed shot; completed takes remain preserved.';
    } else if (pending.length) {
      current.status = 'generating';
      current.nextAction = `Waiting for ${pending.length} provider job${pending.length === 1 ? '' : 's'}.`;
    } else if (matchingExport?.status === 'rendering') {
      current.status = 'awaiting_qc';
      const exportTask = current.tasks?.find((task) => task.kind === 'export');
      if (exportTask) { exportTask.status = 'running'; exportTask.reason = null; }
      current.nextAction = matchingExport.progress || 'Rendering the final film.';
    } else if (autoExportError) {
      current.status = 'needs_attention';
      current.error = autoExportError;
      current.nextAction = `The selected takes are ready, but final export needs attention: ${autoExportError}`;
    } else if (reviewable.length === versions.length) {
      current.status = 'needs_attention';
      const media = current.tasks?.find((task) => task.kind === 'media');
      if (media) media.status = 'review';
      current.nextAction = 'Generated takes are ready for evidence-based review before sound mix and export.';
    }
    return { runId, status: current.status, pending: pending.length, reviewable: reviewable.length };
  });
}

const activeMediaRuns = new Set();
async function launchMedia(filmId, runId) {
  if (activeMediaRuns.has(runId)) return;
  activeMediaRuns.add(runId);
  try {
    const film = getFilm(filmId), run = film.concierge.runs.find((item) => item.id === runId);
    if (!run || run.status !== 'generating') return;
    const shots = film.shots.filter((shot) => shot.conciergeRunId === runId);
    const pendingShots = shots.filter((shot) => !film.versions.some((version) => version.idempotencyKey === `${runId}:${shot.id}`));
    const liveJobs = pendingShots.map((shot) => {
      const modelId = run.plan.models.videoByShot?.[shot.planShotId] || run.plan.models.video;
      const model = getModel(modelId);
      const plannedOptions = run.plan.routePlan?.videoOptionsByShot?.[shot.planShotId] || {};
      const quoted = quoteVideoJobs(model, [shot], film.aspectRatio, run.plan.audioRoute, plannedOptions).jobs[0];
      return { ...quoted, modelId };
    });
    const liveQuote = { jobs: liveJobs, total: Math.round(liveJobs.reduce((sum, job) => sum + job.cost, 0) * 10000) / 10000 };
    const remainingBudget = Math.round((run.budget.cap - run.budget.reserved - run.budget.committed) * 10000) / 10000;
    if (liveQuote.total > remainingBudget)
      throw new Error(`Live provider price $${liveQuote.total.toFixed(4)} exceeds the remaining authorized budget $${remainingBudget.toFixed(4)}. Review the new quote before generating.`);
    const quotedJobs = new Map(liveQuote.jobs.map((job) => [job.shotId, job]));
    const versionIds = [];
    for (const shot of shots) {
      const current = getFilm(filmId);
      const currentRun = current.concierge?.runs?.find((item) => item.id === runId);
      if (!currentRun || ['paused', 'cancelled'].includes(currentRun.status)) return;
      const latest = current.versions.find((version) => version.idempotencyKey === `${runId}:${shot.id}`);
      if (latest) { versionIds.push(latest.id); continue; }
      const refreshed = current.shots.find((item) => item.id === shot.id);
      const quotedJob = quotedJobs.get(shot.id);
      if (!quotedJob) throw new Error('Live video quote is missing for a pending shot.');
      const generationOptions = quotedJob.options;
      const selectedModel = getModel(quotedJob.modelId);
      const taskId = `video:${shot.id}`;
      upsertDirectorTask(filmId, runId, { taskKey: taskId, kind: 'video', targetId: shot.id, status: 'ready', inputHash: run.planHash });
      const claimed = claimDirectorTask(filmId, runId, taskId, `runner:${process.pid}`);
      if (!claimed) continue;
      try { reserveRunTask(filmId, runId, taskId, quotedJob.cost); }
      catch (error) {
        transitionDirectorTask(filmId, runId, taskId, 'blocked', { error: error.message });
        throw error;
      }
      const references = (refreshed.referenceVersionIds || [])
        .map((id) => current.versions.find((version) => version.id === id))
        .filter((version) => version && version.localPath && version.status !== 'rejected')
        .map((version) => version.id);
      const referenceInputs = (run.inputs || []).filter((input) => references.includes(input.id));
      let result;
      try {
        // Task claiming and budget reservation both persist audit records and
        // advance the film revision. Read the revision after those writes so
        // optimistic concurrency protects real user edits instead of rejecting
        // the runner's own bookkeeping.
        const submissionRevision = getFilm(filmId).revision;
        result = generate(filmId, {
        model: quotedJob.modelId, workflowTask: 'video', shotId: shot.id, references,
        prompt: `${refreshed.prompt}\nCAMERA: ${refreshed.camera}\nLIGHTING: ${refreshed.lighting}\nCONTINUITY: ${refreshed.continuity}\n${shotAudioPolicy(run.plan.audioRoute)}${referencePromptSuffix(selectedModel, referenceInputs)}`,
        options: generationOptions,
        confirmCost: true, idempotencyKey: `${runId}:${shot.id}`, expectedRevision: submissionRevision,
        });
      } catch (error) {
        releaseRunTask(filmId, runId, taskId, 'generation_rejected');
        transitionDirectorTask(filmId, runId, taskId, 'retryable_failed', { error: error.message });
        throw error;
      }
      const created = result.versions.find((version) => version.idempotencyKey === `${runId}:${shot.id}`);
      if (created) {
        versionIds.push(created.id);
        transitionDirectorTask(filmId, runId, taskId, 'provider_pending', { outputVersionIds: [created.id] });
      }
    }
    mutate(filmId, 'production.media_submitted', (f) => {
      const current = f.concierge.runs.find((item) => item.id === runId);
      if (!current) return { runId };
      if (['paused', 'cancelled'].includes(current.status))
        return { runId, status: current.status, skipped: true };
      current.versionIds = versionIds;
      current.status = 'awaiting_qc';
      const media = current.tasks.find((task) => task.kind === 'media');
      if (media) { media.status = 'submitted'; media.reason = null; }
      current.nextAction = 'Review generated takes and run evidence-based QC before selecting the cut.';
      return { runId, versionIds };
    });
  } catch (error) {
    mutate(filmId, 'production.media_failed', (f) => {
      const current = f.concierge.runs.find((item) => item.id === runId);
      if (current) { current.status = 'failed'; current.error = error.message; current.nextAction = 'Fix the provider or input issue and retry this run.'; }
      return { runId, error: error.message };
    });
  } finally { activeMediaRuns.delete(runId); }
}

// Kept as a function boundary so the queue can later be moved to a durable worker.
export function startProductionRunner(interval = 1500) {
  recoverExpiredDirectorTasks();
  const timer = setInterval(() => {
    try { recoverExpiredDirectorTasks(); tickProductionRuns(); } catch (error) { console.error('production runner:', error.message); }
  }, interval);
  return timer;
}

function listActiveFilms() {
  return listFilms().map((row) => getFilm(row.id)).filter((film) => film.concierge?.runs?.some((run) => ['queued', 'generating', 'awaiting_media', 'awaiting_qc', 'needs_attention'].includes(run.status)));
}
