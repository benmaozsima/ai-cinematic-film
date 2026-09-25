import { createHash } from 'node:crypto';
import { fail } from './store.mjs';

const ASPECTS = new Set(['16:9', '9:16', '1:1']);
const AUDIO_ROUTES = new Set(['native_ambience', 'native_dialogue', 'separate_speech_lipsync', 'voiceover_mix', 'silent']);

export function stableHash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function normalizeBrief(text) {
  const source = String(text || '').trim();
  if (!source || source.length > 12000) fail('Creative brief is required (maximum 12000 characters).');
  // Prefer an explicit top-level runtime, including common compounds such as
  // "20-second". Shot time ranges (for example "0–5 seconds") must not
  // silently replace the requested film duration.
  const durationMatch = source.match(/(\d+)\s*(?:[-–—]\s*)?(?:שניות|שניה|seconds?|sec)/i);
  const requestedDuration = Number(durationMatch?.[1] || 20);
  const durationSec = Math.max(5, Math.min(60, Number.isFinite(requestedDuration) ? requestedDuration : 20));
  const lower = source.toLowerCase();
  const aspectRatio = /אייפון|טלפון|נייד|אנכי|סטורי|טיקטוק|reel|vertical|portrait|9:16/.test(lower)
    ? '9:16'
    : /ריבוע|square|1:1/.test(lower) ? '1:1' : '16:9';
  const language = /[\u0590-\u05ff]/.test(source) ? 'he' : 'en';
  const silent = /ללא קול|אילם|silent|no sound/i.test(source);
  const noSpeech = /ללא דיבור|בלי דיבור|ללא קריינות|בלי קריינות|no (?:dialogue|speech|voice)|without (?:dialogue|speech|voice)/i.test(source);
  const speech = !silent && !noSpeech && /דיבור|מדבר|קריינות|dialogue|voice|speaks/i.test(source);
  return {
    durationSec, aspectRatio, language,
    audience: '', goal: '', style: '', mandatoryBeats: [], constraints: [],
    audioPreference: silent ? 'silent' : speech ? 'speech' : 'sound',
    source,
  };
}

export function shotDurations(durationSec, maxShots = 12) {
  const count = Math.max(1, Math.min(maxShots, Math.ceil(durationSec / 5)));
  const base = Math.floor(durationSec / count);
  const remainder = durationSec - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

export function proposalShotPlan(brief) {
  const sequenceText = brief.source.match(/(?:^|\n)\s*(?:sequence|סיקוונס|רצף)\s*:\s*([\s\S]*?)(?=\n\s*(?:end text|important details|style|audio|final on-screen text)\s*:|$)/i)?.[1] || '';
  const sequenceStepCount = [...sequenceText.matchAll(/(?:^|\n)\s*\d{1,2}[.)]\s+/g)].length;
  const requestedCount = Number(
    brief.source.match(/(?:^|\b)(\d+)\s*(?:connected\s+)?(?:cinematic\s+)?(?:shots?|שוטים|סצנות)/iu)?.[1],
  );
  const count = Number.isInteger(requestedCount) && requestedCount >= 1 && requestedCount <= 12
    ? requestedCount
    : sequenceStepCount >= 2
    ? Math.min(12, sequenceStepCount)
    : Math.max(1, Math.min(12, Math.ceil(brief.durationSec / 5)));
  const base = Math.floor(brief.durationSec / count);
  const remainder = brief.durationSec - base * count;
  const durations = Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
  const shotBlocks = [...brief.source.matchAll(/(?:^|\n)\s*SHOT\s+\d+\s*[—–-][\s\S]*?(?=(?:\n\s*SHOT\s+\d+\s*[—–-])|$)/gi)]
    .map((match) => match[0].trim());
  const explicitScenes = brief.source
    .split(/;\s*(?=(?:בסצנה|סצנה|scene)\s*(?:השני(?:יה|ה)|השלישי(?:ת)?|\d+|two|three))/i)
    .map((part) => part.trim())
    .filter(Boolean);
  // Many real briefs use a screenplay-style numbered Sequence instead of
  // explicit SHOT blocks. Split those numbered beats before falling back to
  // the whole brief; otherwise every generated shot repeats the entire film
  // and headings such as "Style" can be mistaken for dialogue.
  const sequenceSteps = [...sequenceText.matchAll(/(?:^|\n)\s*(\d{1,2})[.)]\s+([\s\S]*?)(?=\n\s*\d{1,2}[.)]\s+|$)/g)]
    .map((match) => match[2].trim())
    .filter(Boolean);
  const actions = shotBlocks.length === durations.length
    ? shotBlocks
    : explicitScenes.length === durations.length
    ? explicitScenes
    : sequenceSteps.length >= 2
    ? sequenceSteps
    : null;
  return durations.map((durationSec, index, all) => ({
    id: `beat-${index + 1}`,
    order: index,
    durationSec,
    purpose: index === 0 ? 'Set the situation' : index === all.length - 1 ? 'Deliver the ending' : 'Advance the visible action',
    // This gets replaced by the LLM planner when it is available. It is still
    // an explicit contract, so no generation runs from an invisible implicit beat.
    visibleAction: actions?.[index]
      ? actions[index]
      : index === 0 ? brief.source : `Continue the central action from the brief: ${brief.source}`,
    transition: index === 0 ? 'cut' : 'motivated cut',
  }));
}

export function validateProposal(proposal) {
  if (!proposal || proposal.schemaVersion !== 1) fail('Unsupported director proposal.');
  const brief = proposal.brief;
  if (!brief || !Number.isInteger(brief.durationSec) || brief.durationSec < 5 || brief.durationSec > 60) fail('Proposal has an invalid duration.');
  if (!ASPECTS.has(brief.aspectRatio)) fail('Proposal has an invalid aspect ratio.');
  if (!Array.isArray(proposal.shots) || !proposal.shots.length || proposal.shots.length > 12) fail('Proposal needs one to twelve shots.');
  const total = proposal.shots.reduce((sum, shot, index) => {
    if (!shot || shot.order !== index || !Number.isFinite(shot.durationSec) || shot.durationSec <= 0 || !String(shot.visibleAction || '').trim()) fail('Proposal contains an invalid shot.');
    return sum + shot.durationSec;
  }, 0);
  if (Math.abs(total - brief.durationSec) > 0.001) fail('Proposal shot durations do not match the requested duration.');
  if (!AUDIO_ROUTES.has(proposal.audioPlan?.route)) fail('Proposal needs an audio route.');
  if (!proposal.routePlan?.videoModel) fail('Proposal needs a video route.');
  return proposal;
}
