export function audioTrackSettings(version) {
  const role = ['dialogue', 'music', 'sfx'].includes(version?.audioRole)
    ? version.audioRole
    : 'sfx';
  return {
    role,
    gain: role === 'music' ? 0.25 : 1,
  };
}
