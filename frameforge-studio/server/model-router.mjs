import { MODELS, referenceCapacity } from './models.mjs';

const kindField = { image: ['image_url', 'image_urls', 'reference_image_urls', 'start_image_url'], video: ['video_url', 'video_urls', 'reference_video_urls'], audio: ['audio_url', 'audio_urls', 'reference_audio_urls'] };

export function inputManifest(inputs = []) {
  const seen = new Set();
  const rows = (Array.isArray(inputs) ? inputs : []).filter((item) => {
    const key = item?.id;
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const kinds = [...new Set(rows.map((item) => item.kind).filter((kind) => ['image', 'video', 'audio'].includes(kind)))];
  const counts = Object.fromEntries(['image', 'video', 'audio'].map((kind) => [kind, rows.filter((item) => item.kind === kind).length]));
  return {
    items: rows.map((item) => ({ id: item.id || null, kind: item.kind, role: item.role || 'reference', label: item.label || '', scope: item.scope || 'auto', source: item.source || 'project' })),
    kinds,
    counts,
    hasImage: kinds.includes('image'), hasVideo: kinds.includes('video'), hasAudio: kinds.includes('audio'),
  };
}

export function recommendModels({ task = 'video', inputs = [], language = 'he', duration = 5 } = {}) {
  const manifest = inputManifest(inputs);
  const candidates = MODELS.filter((model) => {
    if (task === 'image') return model.kind === 'image';
    if (['dialogue', 'speech', 'voice'].includes(task)) return model.task === 'Dialogue / voice';
    if (task === 'audio') return model.kind === 'audio';
    if (task === 'lipsync') return model.task === 'Lip-sync' || model.task === 'Avatar lip-sync';
    return model.task === 'Video' || model.task === 'Avatar lip-sync';
  }).filter((model) => {
    const required = model.task === 'Lip-sync'
      ? ['video', 'audio']
      : model.task === 'Avatar lip-sync'
        ? ['image', 'audio']
        : model.kind === 'image' && (model.fields || []).some((field) => ['image_url', 'image_urls', 'reference_image_urls'].includes(field))
          ? ['image']
          : model.task === 'Video' && (/image-to-video/.test(model.id) || (model.fields || []).includes('start_image_url'))
            ? ['image'] : [];
    if (required.some((kind) => !manifest.counts[kind])) return false;
    if (/reference-to-video|wan3_prime/.test(model.id) && !manifest.items.length) return false;
    return true;
  }).filter((model) => {
    const fields = model.fields || [];
    return !manifest.kinds.some((kind) => {
      if (!kindField[kind].some((field) => fields.includes(field))) return true;
      const limit = referenceCapacity(model, kind);
      return limit == null || manifest.counts[kind] > limit;
    });
  }).filter((model) => !(language === 'he' && model.capabilities?.nativeLanguages && !model.capabilities.nativeLanguages.includes('he') && task === 'dialogue'));
  return candidates.map((model) => {
    let score = 50;
    if (manifest.hasImage && (model.fields || []).some((field) => field.includes('image'))) score += 30;
    if (manifest.hasVideo && (model.fields || []).some((field) => field.includes('video'))) score += 20;
    if (manifest.hasAudio && (model.fields || []).some((field) => field.includes('audio'))) score += 20;
    if (model.capabilities?.durations?.includes(String(duration))) score += 10;
    // In a hands-off chat run, never nominate an image-conditioned model when
    // the filmmaker supplied no image. It would fail later asking for a
    // keyframe that the chat did not promise to create.
    if (!manifest.hasImage && (model.fields || []).some((field) => ['image_url', 'image_urls', 'reference_image_urls', 'start_image_url'].includes(field))) score -= 30;
    // A chat-run must not accidentally select an adapter with unknown pricing:
    // unknown-price models remain selectable in the advanced workspace.
    if (model.pricing) score += 15;
    if (language === 'he' && model.kind === 'video' && model.task === 'Lip-sync') score += 5;
    return { id: model.id, name: model.name, kind: model.kind, task: model.task, score, acceptedInputs: model.fields || [], reason: manifest.kinds.length ? `Matches ${manifest.kinds.join(', ')} reference inputs.` : 'Text-led default; add references when identity or continuity matters.' };
  }).sort((a, b) => b.score - a.score);
}
