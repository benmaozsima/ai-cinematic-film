import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

const dir = mkdtempSync(resolve(tmpdir(), 'frameforge-concierge-'));
process.env.FRAMEFORGE_DATA_DIR = dir;
const S = await import('../server/store.mjs');
const C = await import('../server/concierge.mjs');
const R = await import('../server/production-runner.mjs');
const B = await import('../server/director-budget.mjs');
const T = await import('../server/director-task-store.mjs');
after(() => { S.db.close(); rmSync(dir, { recursive: true, force: true }); });

test('director chat honors an explicit cheap MiniMax H3 Turbo route and quotes it accurately', () => {
  const film = S.createFilm({ title: 'MiniMax route' });
  const result = C.concierge(film.id, {
    brief: 'סרטון אנכי 10 שניות בדיוק, שתי סצנות של 5 שניות, MiniMax H3 Max Turbo הכי מהיר וזול, ללא דיבור',
    mode: 'plan',
  });
  assert.equal(result.plan.models.video, 'minimax/h3-max-turbo/text-to-video');
  assert.equal(result.plan.shotCount, 2);
  assert.equal(result.plan.calls.assets, 0);
  assert.equal(result.plan.estimatedCost, 0.125);
  assert.equal(result.plan.quote.cap, 0.175);
});

test('director concierge turns a natural brief into a persistent cinematic proposal', () => {
  process.env.FRAMEFORGE_RUNNER_DISABLE_MEDIA = '1';
  const film = S.createFilm({ title: 'Concierge test' });
  S.mutate(film.id, 'test.portrait_attachment', (current) => {
    current.versions.push({ id: 'portrait', kind: 'image', source: 'import', status: 'review', localPath: 'assets/portrait.png', references: [], checks: {}, notes: [] });
  });
  C.saveConciergeDraft(film.id, { text: 'draft that survives reload', attachments: [{ id: 'portrait', role: 'location' }] });
  assert.equal(C.conciergeState(film.id).draft.text, 'draft that survives reload');
  assert.deepEqual(C.conciergeState(film.id).draft.attachments, [{ id: 'portrait', kind: 'image', label: 'image reference', role: 'location', scope: 'auto', source: 'upload' }]);
  const result = C.concierge(film.id, {
    brief: 'סרטון אנכי של 20 שניות על תלמידה שפוגשת רובוט בחלל ללא דיבור',
    inputs: [{ id: 'portrait', kind: 'image', role: 'identity' }],
    mode: 'plan',
  });
  assert.equal(result.plan.aspectRatio, '9:16');
  assert.equal(result.plan.shotCount, 4);
  assert.equal(result.plan.audioRoute, 'native_ambience');
  assert.ok(result.plan.models.video);
  assert.ok(result.plan.routing.some((model) => model.id === result.plan.models.video));
  assert.ok(result.plan.quote.cap > result.plan.quote.estimated);
  assert.deepEqual(result.plan.inputManifest.kinds, ['image']);
  assert.equal(C.conciergeState(film.id).plans.length, 1);
  const proposalId = C.conciergeState(film.id).plans[0].id;
  const proposalHash = C.conciergeState(film.id).plans[0].planHash;
  assert.equal(typeof proposalHash, 'string');
  const brief = 'סרטון אנכי של 20 שניות על תלמידה שפוגשת רובוט בחלל ללא דיבור';
  const queued = C.concierge(film.id, { brief, mode: 'authorize', planId: proposalId, idempotencyKey: 'run-1' });
  assert.equal(queued.status, 'authorize');
  assert.equal(queued.planHash, proposalHash);
  assert.deepEqual(C.conciergeAgentState(film.id).allowedActions, ['view_progress', 'pause', 'open_advanced']);
  R.tickProductionRuns();
  const running = C.conciergeState(film.id).runs[0];
  assert.equal(running.status, 'awaiting_media');
  assert.ok(running.budget.cap >= result.plan.quote.estimated);
  assert.equal(running.tasks.length, 8);
  assert.equal(T.listDirectorTasks(film.id, running.id).length, 8);
  assert.equal(running.tasks.find((task) => task.kind === 'asset_plan').status, 'succeeded');
  assert.match(running.tasks.find((task) => task.kind === 'media').reason, /FAL key/);
  C.runAction(film.id, running.id, { action: 'pause' });
  assert.equal(C.conciergeAgentState(film.id).run.status, 'paused');
  assert.deepEqual(C.conciergeAgentState(film.id).allowedActions, ['resume', 'cancel', 'open_advanced']);
  C.runAction(film.id, running.id, { action: 'resume' });
  assert.equal(C.conciergeAgentState(film.id).run.status, 'queued');
  B.reserveRunTask(film.id, running.id, `video:${S.getFilm(film.id).shots[0].id}`, 0);
  S.mutate(film.id, 'test.generated_take_ready', (current) => {
    current.versions.push({ id: 'take-ready', status: 'review', kind: 'video', shotId: current.shots[0].id, localPath: 'take.mp4' });
    const active = current.concierge.runs[0];
    active.status = 'awaiting_qc';
    active.versionIds = ['take-ready'];
    return {};
  });
  R.refreshRunProgress(film.id, running.id);
  assert.equal(C.conciergeAgentState(film.id).run.status, 'needs_attention');
  assert.equal(S.getFilm(film.id).concierge.runs[0].budget.reservations[0].status, 'committed');
  const scaffold = S.getFilm(film.id);
  assert.equal(scaffold.shots.length, 4);
  assert.equal(scaffold.shots.every((shot) => shot.conciergeRunId === running.id), true);
  // The chat input is carried into every generated shot as explicit
  // provenance, rather than being a transient attachment that disappears
  // between the plan and the provider request.
  assert.deepEqual(scaffold.shots.map((shot) => shot.referenceVersionIds), [['portrait'], ['portrait'], ['portrait'], ['portrait']]);
  assert.equal(scaffold.entities.filter((entity) => entity.conciergeRunId === running.id).length, 1);
  assert.equal(scaffold.entities.at(-1).locked, true);
  assert.deepEqual(scaffold.shots.map((shot) => shot.entityIds), [[scaffold.entities.at(-1).id], [scaffold.entities.at(-1).id], [scaffold.entities.at(-1).id], [scaffold.entities.at(-1).id]]);
  assert.throws(() => B.reserveRunTask(film.id, running.id, 'unknown-price', null), /price is unavailable/);
  B.reserveRunTask(film.id, running.id, 'missing-actual', 0);
  assert.throws(() => B.commitRunTask(film.id, running.id, 'missing-actual', undefined), /cost is unavailable/);
  assert.equal(C.concierge(film.id, { brief, mode: 'authorize', planId: proposalId, idempotencyKey: 'run-1' }).alreadyStarted, true);
  assert.throws(() => C.concierge(film.id, { brief: 'direct start', mode: 'authorize', idempotencyKey: 'run-2' }), /approved proposal/);
  delete process.env.FRAMEFORGE_RUNNER_DISABLE_MEDIA;
});

test('the active cut hides superseded chat runs while preserving their history', () => {
  const film = S.createFilm({ title: 'Active cut isolation' });
  S.mutate(film.id, 'test.multiple_chat_runs', (current) => {
    current.concierge = {
      messages: [], plans: [], activeRunId: 'new-run',
      runs: [{ id: 'old-run' }, { id: 'new-run' }],
    };
    current.scenes.push(
      { id: 'old-scene', conciergeRunId: 'old-run', order: 0 },
      { id: 'new-scene', conciergeRunId: 'new-run', order: 1 },
    );
    current.shots.push(
      { id: 'old-shot', sceneId: 'old-scene', conciergeRunId: 'old-run', order: 0 },
      { id: 'new-shot', sceneId: 'new-scene', conciergeRunId: 'new-run', order: 1 },
      { id: 'manual-shot', sceneId: 'manual-scene', order: 2 },
    );
    current.entities.push(
      { id: 'old-entity', conciergeRunId: 'old-run' },
      { id: 'new-entity', conciergeRunId: 'new-run' },
      { id: 'manual-entity' },
    );
  });
  const stored = S.getFilm(film.id);
  const active = S.activeCutView(stored);
  assert.deepEqual(stored.shots.map((shot) => shot.id), ['old-shot', 'new-shot', 'manual-shot']);
  assert.deepEqual(active.shots.map((shot) => shot.id), ['new-shot', 'manual-shot']);
  assert.deepEqual(active.scenes.map((scene) => scene.id), ['new-scene']);
  assert.deepEqual(active.entities.map((entity) => entity.id), ['new-entity', 'manual-entity']);
});

test('automatic and explicit scopes map each reference only to its intended shot', () => {
  const shots = [
    { id: 'beat-1', visibleAction: 'Adam enters the old kitchen.' },
    { id: 'beat-2', visibleAction: 'Dana waits on the moon base.' },
  ];
  const automatic = C.assignReferencesToShots([
    { id: 'adam', role: 'identity', label: 'Adam.jpg', scope: 'auto' },
    { id: 'dana', role: 'identity', label: 'Dana.png', scope: 'auto' },
    { id: 'look', role: 'style', label: 'cinematic-look.png', scope: 'auto' },
  ], shots);
  assert.deepEqual(automatic, [
    { shotId: 'beat-1', inputIds: ['adam', 'look'] },
    { shotId: 'beat-2', inputIds: ['dana', 'look'] },
  ]);
  const explicit = C.assignReferencesToShots([
    { id: 'kitchen', role: 'location', label: 'Kitchen.jpg', scope: 'beat-1' },
    { id: 'moon', role: 'location', label: 'Moon.jpg', scope: 'beat-2' },
  ], shots);
  assert.deepEqual(explicit, [
    { shotId: 'beat-1', inputIds: ['kitchen'] },
    { shotId: 'beat-2', inputIds: ['moon'] },
  ]);
});

test('two character references follow a man and woman together through every matching shot', () => {
  const shots = [
    { id: 'beat-1', visibleAction: 'A man and a woman build a sukkah together.' },
    { id: 'beat-2', visibleAction: 'The man and the woman sit inside and laugh.' },
    { id: 'beat-3', visibleAction: 'They argue, then both of them laugh.' },
  ];
  assert.deepEqual(C.assignReferencesToShots([
    { id: 'man', role: 'identity', label: 'man.jpg', scope: 'auto' },
    { id: 'woman', role: 'identity', label: 'woman.jpg', scope: 'auto' },
  ], shots), [
    { shotId: 'beat-1', inputIds: ['man', 'woman'] },
    { shotId: 'beat-2', inputIds: ['man', 'woman'] },
    { shotId: 'beat-3', inputIds: ['man', 'woman'] },
  ]);
});

test('best-value planning chooses a priced multi-reference route and exposes alternatives', () => {
  const film = S.createFilm({ title: 'Adaptive multi-reference routing' });
  S.mutate(film.id, 'test.references', (current) => {
    current.versions.push(
      { id: 'person-a', kind: 'image', source: 'import', status: 'review', localPath: 'a.png', references: [], checks: {}, notes: [] },
      { id: 'person-b', kind: 'image', source: 'import', status: 'review', localPath: 'b.png', references: [], checks: {}, notes: [] },
    );
  });
  const result = C.concierge(film.id, {
    brief: '20-second vertical English film. A man and a woman talk together in four connected shots.',
    inputs: [
      { id: 'person-a', kind: 'image', role: 'identity', scope: 'all' },
      { id: 'person-b', kind: 'image', role: 'identity', scope: 'all' },
    ],
    mode: 'plan',
  });
  assert.equal(result.plan.models.video, 'minimax/h3-max/reference-to-video');
  assert.equal(result.plan.estimatedCost, 1.6);
  assert.equal(result.plan.routePlan.selectionPolicy, 'best-value');
  assert.ok(result.plan.routePlan.options.some((option) => option.modelId === 'bytedance/seedance-2.5/reference-to-video' && option.estimatedCost > 9));
});

test('director chat routes each shot for its own assigned references', () => {
  const film = S.createFilm({ title: 'Per-shot routing' });
  S.mutate(film.id, 'test.reference', (current) => {
    current.versions.push({ id: 'only-first', kind: 'image', source: 'import', status: 'review', localPath: 'first.png', references: [], checks: {}, notes: [] });
  });
  const result = C.concierge(film.id, {
    brief: '10 seconds, two scenes: first a person enters a room. second the empty room changes color. No dialogue.',
    inputs: [{ id: 'only-first', kind: 'image', role: 'identity', scope: 'beat-1' }],
    mode: 'plan',
  });
  assert.match(result.plan.models.videoByShot['beat-1'], /(image|reference)-to-video/);
  assert.match(result.plan.models.videoByShot['beat-2'], /text-to-video/);
});

test('safe retry releases only unsubmitted failures and preserves their history', () => {
  process.env.FRAMEFORGE_RUNNER_DISABLE_MEDIA = '1';
  const film = S.createFilm({ title: 'Safe retry' });
  const brief = '5 second cinematic test without dialogue';
  const planned = C.concierge(film.id, { brief, mode: 'plan' });
  C.concierge(film.id, { brief, mode: 'authorize', planId: planned.proposalId, idempotencyKey: 'safe-retry' });
  R.tickProductionRuns();
  let current = S.getFilm(film.id), run = current.concierge.runs[0];
  const shot = current.shots[0];
  const taskId = `video:${shot.id}`;
  T.upsertDirectorTask(film.id, run.id, { taskKey: taskId, kind: 'video', targetId: shot.id, status: 'ready' });
  B.reserveRunTask(film.id, run.id, taskId, 0.01);
  T.transitionDirectorTask(film.id, run.id, taskId, 'retryable_failed', { error: 'TLS failed before submit' });
  S.mutate(film.id, 'test.unsubmitted_failure', (next) => {
    next.versions.push({ id: 'failed-before-submit', shotId: shot.id, kind: 'video', status: 'failed', idempotencyKey: `${run.id}:${shot.id}`, error: 'TLS failed before submit' });
    const active = next.concierge.runs[0];
    active.status = 'failed'; active.error = 'TLS failed before submit'; active.versionIds = ['failed-before-submit'];
  });
  C.runAction(film.id, run.id, { action: 'retry' });
  current = S.getFilm(film.id); run = current.concierge.runs[0];
  assert.equal(run.status, 'generating');
  assert.equal(run.budget.reserved, 0);
  assert.equal(run.budget.reservations[0].status, 'released');
  assert.equal(current.versions.find((version) => version.id === 'failed-before-submit').idempotencyKey, undefined);
  assert.equal(T.listDirectorTasks(film.id, run.id).find((task) => task.taskKey === taskId).status, 'ready');
  delete process.env.FRAMEFORGE_RUNNER_DISABLE_MEDIA;
});

test('the paid scaffold preserves the per-shot reference mapping', () => {
  process.env.FRAMEFORGE_RUNNER_DISABLE_MEDIA = '1';
  const film = S.createFilm({ title: 'Scoped references' });
  S.mutate(film.id, 'test.scoped_inputs', (current) => {
    current.versions.push(
      { id: 'adam', label: 'Adam.jpg', kind: 'image', source: 'import', status: 'review', localPath: 'assets/adam.jpg' },
      { id: 'moon', label: 'Moon.jpg', kind: 'image', source: 'import', status: 'review', localPath: 'assets/moon.jpg' },
    );
  });
  const brief = '10 second vertical MiniMax H3 Turbo film; scene two on the moon; no speech';
  const planned = C.concierge(film.id, {
    brief, mode: 'plan', inputs: [
      { id: 'adam', kind: 'image', role: 'identity', scope: 'beat-1' },
      { id: 'moon', kind: 'image', role: 'location', scope: 'beat-2' },
    ],
  });
  C.concierge(film.id, { brief, mode: 'authorize', planId: planned.proposalId, idempotencyKey: 'scoped-run', budgetCap: planned.plan.quote.cap });
  R.tickProductionRuns();
  const shots = S.getFilm(film.id).shots;
  assert.deepEqual(shots.map((shot) => shot.referenceVersionIds), [['adam'], ['moon']]);
  assert.equal(shots[0].entityIds.length, 1);
  assert.equal(shots[1].entityIds.length, 1);
  assert.notEqual(shots[0].entityIds[0], shots[1].entityIds[0]);
  delete process.env.FRAMEFORGE_RUNNER_DISABLE_MEDIA;
});

test('paid authorization is atomic and English native dialogue avoids the manual lipsync blocker', () => {
  const film = S.createFilm({ title: 'Authorization safety' });
  const brief = '10 second vertical MiniMax H3 Turbo film, two scenes, no speech';
  const planned = C.concierge(film.id, { brief, mode: 'plan' });
  assert.throws(() => C.concierge(film.id, {
    brief, mode: 'authorize', planId: planned.proposalId,
    idempotencyKey: 'too-cheap', budgetCap: 0.01,
  }), /Authorize at least/i);
  assert.equal(C.conciergeState(film.id).runs.length, 0);
  const authorized = C.concierge(film.id, {
    brief, mode: 'authorize', planId: planned.proposalId,
    idempotencyKey: 'safe-run', budgetCap: planned.plan.quote.cap,
  });
  assert.ok(authorized.runId);
  assert.throws(() => C.concierge(film.id, {
    brief, mode: 'authorize', planId: planned.proposalId,
    idempotencyKey: 'duplicate-run', budgetCap: planned.plan.quote.cap,
  }), /approved proposal|already used/i);
  const englishSpeechBrief = '10-second vertical film in English. A man and woman speak dialogue. MiniMax H3 Max Turbo.';
  const englishSpeech = C.concierge(film.id, { brief: englishSpeechBrief, mode: 'plan' });
  assert.equal(englishSpeech.plan.audioRoute, 'native_dialogue');
  assert.equal(englishSpeech.plan.calls.speech, 0);
  assert.doesNotThrow(() => C.concierge(film.id, {
    brief: englishSpeechBrief, mode: 'authorize', planId: englishSpeech.proposalId,
    idempotencyKey: 'english-native-speech', budgetCap: englishSpeech.plan.quote.cap,
  }));
  const speechBrief = 'סרטון אנכי של 10 שניות עם דיבור בעברית';
  const speech = C.concierge(film.id, { brief: speechBrief, mode: 'plan' });
  assert.throws(() => C.concierge(film.id, {
    brief: speechBrief, mode: 'authorize', planId: speech.proposalId,
    idempotencyKey: 'speech-run', budgetCap: speech.plan.quote.cap,
  }), /speech and lip-sync are not yet wired/i);
});

test('chat attachments must resolve to matching local production assets', () => {
  const film = S.createFilm({ title: 'Attachment safety' });
  assert.throws(() => C.concierge(film.id, {
    brief: '5 second silent film', mode: 'plan',
    inputs: [{ id: 'missing', kind: 'image', role: 'identity' }],
  }), /ready local production asset/i);
  S.mutate(film.id, 'test.attachment', (current) => {
    current.versions.push({ id: 'sound', kind: 'audio', source: 'import', status: 'review', localPath: 'assets/sound.wav' });
  });
  assert.throws(() => C.concierge(film.id, {
    brief: '5 second silent film', mode: 'plan',
    inputs: [{ id: 'sound', kind: 'image', role: 'identity' }],
  }), /type does not match/i);
});

test('archive failures are terminal run failures instead of stuck QC', () => {
  const film = S.createFilm({ title: 'Archive failure' });
  S.mutate(film.id, 'test.archive_failure', (current) => {
    current.versions.push({ id: 'bad-archive', kind: 'video', status: 'archive_failed', error: 'Could not archive provider output.' });
    current.concierge = { plans: [], messages: [], runs: [{ id: 'run', status: 'awaiting_qc', versionIds: ['bad-archive'], tasks: [] }] };
  });
  R.refreshRunProgress(film.id, 'run');
  assert.equal(C.conciergeState(film.id).runs[0].status, 'failed');
  assert.match(C.conciergeState(film.id).runs[0].error, /archive provider output/i);
});

test('a reviewed selected cut and completed final export completes the chat run', () => {
  const film = S.createFilm({ title: 'Completed chat run' });
  S.mutate(film.id, 'test.completed_run', (current) => {
    current.scenes.push({ id: 'scene', title: 'Scene', order: 0 });
    current.shots.push({ id: 'shot', code: 'SH001', title: 'Shot', sceneId: 'scene', order: 0, duration: 5, trimIn: 0, conciergeRunId: 'run', selectedVersionId: 'take' });
    current.versions.push({ id: 'take', kind: 'video', status: 'approved', shotId: 'shot', localPath: 'assets/take.mp4', checks: Object.fromEntries(S.CHECKS.video.map((key) => [key, 'pass'])), notes: [], reviewBibleRevision: current.bibleRevision, reviewShotRevision: 0 });
    current.concierge = { plans: [], messages: [], activeRunId: 'run', runs: [{ id: 'run', status: 'needs_attention', versionIds: ['take'], createdAt: '2026-01-01T00:00:00.000Z', tasks: [{ kind: 'media' }, { kind: 'audio' }, { kind: 'qc' }, { kind: 'export' }] }] };
  });
  S.db.prepare('INSERT INTO exports(id,film_id,data) VALUES (?,?,?)').run('export', film.id, JSON.stringify({ id: 'export', filmId: film.id, final: true, status: 'complete', filename: 'film.mp4', duration: 5, createdAt: '2026-01-01T00:01:00.000Z', activeRunId: 'run', cutVersionIds: ['take'] }));
  R.refreshRunProgress(film.id, 'run');
  const run = C.conciergeState(film.id).runs[0];
  assert.equal(run.status, 'completed');
  assert.equal(run.result.exportId, 'export');
  assert.equal(run.tasks.every((task) => task.status === 'succeeded'), true);
});
