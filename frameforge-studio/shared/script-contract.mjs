export function spokenDialogue(dialogue = '') {
  const value = String(dialogue).trim();
  const spoken = value.includes(':') ? value.slice(value.lastIndexOf(':') + 1) : value;
  return spoken.replace(/[״“”"']/g, '').trim();
}

export function normalizedSpeech(value = '') {
  return String(value)
    .replace(/[״“”"'.,!?…:;־-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchesApprovedDialogue(spoken, dialogue) {
  return normalizedSpeech(spoken) === normalizedSpeech(spokenDialogue(dialogue));
}
