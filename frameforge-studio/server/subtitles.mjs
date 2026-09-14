export function subtitles(f) {
  const time = (seconds) => {
    const ms = Math.round(seconds * 1000);
    const pad = (v, n = 2) => String(v).padStart(n, '0');
    return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`;
  };
  let offset = 0,
    count = 0;
  const lines = [];
  for (const shot of [...f.shots].sort((a, b) => a.order - b.order)) {
    for (const cue of shot.captions || [])
      lines.push(
        `${++count}\n${time(offset + cue.start)} --> ${time(offset + cue.end)}\n${cue.text}\n`,
      );
    offset += shot.duration;
  }
  return '\uFEFF' + lines.join('\n');
}
