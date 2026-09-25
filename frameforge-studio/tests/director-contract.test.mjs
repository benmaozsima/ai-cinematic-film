import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBrief, proposalShotPlan, validateProposal } from '../server/director-contract.mjs';

test('director contract keeps a short vertical brief within the supported production envelope', () => {
  const brief = normalizeBrief('סרטון אנכי של 10 שניות על רובוט בבית ספר עם קריינות');
  assert.equal(brief.durationSec, 10);
  assert.equal(brief.aspectRatio, '9:16');
  assert.equal(brief.audioPreference, 'speech');
  const shots = proposalShotPlan(brief);
  assert.deepEqual(shots.map((shot) => shot.durationSec), [5, 5]);
  assert.doesNotThrow(() => validateProposal({
    schemaVersion: 1, brief, shots,
    audioPlan: { route: 'separate_speech_lipsync' }, routePlan: { videoModel: 'test/video' },
  }));
});

test('director contract rejects a proposal that silently changes the requested runtime', () => {
  const brief = normalizeBrief('A 10 second landscape film');
  assert.throws(() => validateProposal({
    schemaVersion: 1, brief,
    shots: [{ order: 0, durationSec: 5, visibleAction: 'A visible action' }],
    audioPlan: { route: 'native_ambience' }, routePlan: { videoModel: 'test/video' },
  }), /durations/);
});

test('explicit two-scene briefs keep each visible action in its own shot', () => {
  const brief = normalizeBrief('סרטון אנכי 10 שניות. רובוט נוסע בגשם; בסצנה השנייה הוא פותח מטרייה לחתול');
  const shots = proposalShotPlan(brief);
  assert.equal(shots.length, 2);
  assert.match(shots[0].visibleAction, /רובוט נוסע בגשם/);
  assert.doesNotMatch(shots[0].visibleAction, /מטרייה/);
  assert.match(shots[1].visibleAction, /מטרייה לחתול/);
});

test('an explicit shot count and SHOT blocks override the five-second default split', () => {
  const brief = normalizeBrief(`3 connected cinematic shots, 8 seconds total, 9:16.
SHOT 1 — 0:00–0:03 — Detail\nClose-up of fabric in motion.
SHOT 2 — 0:03–0:06 — Run\nTwo friends run along the beach.
SHOT 3 — 0:06–0:08 — Finish\nThey splash at the shoreline.`);
  const shots = proposalShotPlan(brief);
  assert.equal(shots.length, 3);
  assert.deepEqual(shots.map((shot) => shot.durationSec), [3, 3, 2]);
  assert.match(shots[1].visibleAction, /run along the beach/i);
});

test('a hyphenated total runtime wins over later shot time ranges', () => {
  const brief = normalizeBrief(`Create a 20-second vertical film.
SHOT 1 — 0–5 seconds
The couple builds a sukkah.
SHOT 2 — 5–10 seconds
They enter it.`);
  assert.equal(brief.durationSec, 20);
});

test('numbered Sequence briefs become isolated visible actions', () => {
  const brief = normalizeBrief(`Create a 20-second vertical film.
Sequence:
1. Opening: a bartender places the tools on the bar.
2. He salts the rim of the glass.
3. He pours tequila into a jigger.
4. He serves the finished margarita.
End text: MARGARITA.`);
  const shots = proposalShotPlan(brief);
  assert.equal(shots.length, 4);
  assert.deepEqual(shots.map((shot) => shot.durationSec), [5, 5, 5, 5]);
  assert.match(shots[0].visibleAction, /places the tools/i);
  assert.doesNotMatch(shots[0].visibleAction, /salts the rim/i);
  assert.match(shots[3].visibleAction, /finished margarita/i);
});
