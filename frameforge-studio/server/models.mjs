import { fail, number } from './store.mjs';
const model = (
  id,
  name,
  task,
  kind,
  description,
  defaults,
  fields,
  pricing,
) => ({
  id,
  name,
  provider: 'fal',
  task,
  kind,
  description,
  defaults,
  fields,
  pricing,
  docs: `https://fal.ai/models/${id}/api`,
});
export const MODELS = [
  model(
    'fal-ai/flux-2',
    'FLUX.2',
    'Keyframe',
    'image',
    'Text-led storyboards and first frames. Use Edit when identity references are required.',
    { image_size: 'landscape_16_9', num_images: 1, output_format: 'png' },
    [],
    null,
  ),
  model(
    'fal-ai/flux-2/edit',
    'FLUX.2 Edit',
    'Reference image / revision',
    'image',
    'Up to four reference images for identity, wardrobe, location, and precise corrections.',
    { image_size: 'landscape_16_9', num_images: 1, output_format: 'png' },
    ['image_urls'],
    null,
  ),
  model(
    'fal-ai/qwen-image',
    'Qwen Image',
    'Keyframe',
    'image',
    'Open image model for detailed character sheets, props, locations, and text-aware concepts.',
    { image_size: 'landscape_16_9', num_images: 1, output_format: 'jpeg' },
    [],
    { unit: 'generation', rate: 0.04, verifiedAt: '2026-09-25', source: 'https://fal.ai/learn/tools/flux-vs-qwen-image' },
  ),
  model(
    'fal-ai/qwen-image/image-to-image',
    'Qwen Image · Edit',
    'Reference image / revision',
    'image',
    'High-fidelity image-to-image editing for wardrobe, pose, prop, and continuity corrections.',
    { image_size: 'landscape_16_9', num_images: 1, output_format: 'jpeg' },
    ['image_url'],
    null,
  ),
  model(
    'fal-ai/flux-pro/kontext',
    'FLUX Kontext Pro',
    'Reference image / revision',
    'image',
    'Targeted edits that preserve the referenced character or object while changing only the requested detail.',
    { aspect_ratio: '16:9', num_images: 1, output_format: 'jpeg' },
    ['image_url'],
    null,
  ),
  model(
    'fal-ai/kling-video/v2.6/pro/image-to-video',
    'Kling 2.6 · image to video',
    'Video',
    'video',
    'Animate an approved frame. 5 or 10 seconds; optional native English / Chinese dialogue.',
    { duration: '5', generate_audio: false },
    ['start_image_url', 'end_image_url'],
    { unit: 'second', silent: 0.07, audio: 0.14 },
  ),
  model(
    'fal-ai/kling-video/v2.6/pro/text-to-video',
    'Kling 2.6 · text to video',
    'Video',
    'video',
    'Text-led motion exploration. 5 or 10 seconds; optional native sound.',
    { duration: '5', aspect_ratio: '16:9', generate_audio: false },
    [],
    { unit: 'second', silent: 0.07, audio: 0.14 },
  ),
  model(
    'fal-ai/elevenlabs/tts/eleven-v3',
    'ElevenLabs v3',
    'Dialogue / voice',
    'audio',
    'Expressive speech. Use a consistent voice name or ID across dialogue versions.',
    { voice: 'Rachel', stability: 0.5 },
    ['voice'],
    { unit: 'character', rate: 0.0001 },
  ),
  model(
    'fal-ai/stable-audio-25/text-to-audio',
    'Stable Audio 2.5',
    'Music / sound effects',
    'audio',
    'Generate score, atmosphere, foley, and sound effects as independent audio assets.',
    { seconds_total: 30 },
    [],
    { unit: 'generation', rate: 0.2 },
  ),
  model(
    'fal-ai/sync-lipsync/v2',
    'Sync Lip-sync 2',
    'Lip-sync',
    'video',
    'Combine a silent picture version with a separately approved dialogue recording.',
    // Dialogue clips are commonly shorter than their picture edit. Keep the
    // approved picture duration and pad the remaining audio with silence.
    { model: 'lipsync-2', sync_mode: 'silence' },
    ['video_url', 'audio_url'],
    null,
  ),
  model(
    'fal-ai/sync-lipsync/v3/image-to-video',
    'Sync 3 · image + audio avatar',
    'Avatar lip-sync',
    'video',
    'Audio-driven talking-character shot from one approved image and dialogue track. Best for a stylized character speaking directly to camera; output length follows the approved audio.',
    {},
    ['image_url', 'audio_url'],
    null,
  ),
];

// Every reference-capable model must declare (or unambiguously imply) how
// many inputs it can consume. Keeping these limits on the registry prevents
// the UI from offering a route that later drops extra references silently.
MODELS.find((item) => item.id === 'fal-ai/flux-2/edit').capabilities = {
  maxImageReferences: 4,
};
MODELS.find((item) => item.id === 'fal-ai/qwen-image/image-to-image').capabilities = {
  maxImageReferences: 1,
};
MODELS.find((item) => item.id === 'fal-ai/flux-pro/kontext').capabilities = {
  maxImageReferences: 1,
};
MODELS.find((item) => item.id === 'fal-ai/sync-lipsync/v2').capabilities = {
  maxVideoReferences: 1,
  maxAudioReferences: 1,
};

const sync3Avatar = MODELS.at(-1);
sync3Avatar.capabilities = {
  nativeAudio: true,
  maxImageReferences: 1,
  maxAudioReferences: 1,
  durations: [],
};
sync3Avatar.recommendation = 'audio-first-talking-character';

// Discovery catalog for providers that can be connected through an adapter.
// These entries are intentionally not added to MODELS until an adapter is
// implemented, so a filmmaker never submits a job that the server cannot run.
// The catalog keeps capability and reference information visible in the UI.
export const PROVIDER_CATALOG = [
  {
    id: 'runway',
    name: 'Runway Dev',
    status: 'catalog',
    credential: 'RUNWAY_API_KEY',
    docs: 'https://docs.dev.runwayml.com/api-details/api_changelog/',
    models: [
      {
        id: 'h3_max', name: 'MiniMax H3 Max', kind: 'video',
        tasks: ['text-to-video', 'image-to-video'],
        references: ['image', 'first/last keyframe'],
        nativeAudio: true, durations: '5–15s', resolutions: '480p, 768p',
        note: 'Runway Dev adapter pending',
      },
      {
        id: 'wan3_prime', name: 'WAN 3.0 Prime', kind: 'video',
        tasks: ['text-to-video', 'image-to-video'],
        references: ['image', 'video', 'audio', 'first/last keyframe'],
        nativeAudio: true, durations: '2–30s', resolutions: '480p, 720p, 1080p',
        note: 'Runway Dev adapter pending',
      },
      {
        id: 'acescg_exr', name: 'ACEScg EXR delivery', kind: 'post',
        tasks: ['HDR delivery'], references: [], nativeAudio: false,
        durations: 'source dependent', resolutions: 'ACES 1.3 / 2.0',
        note: 'Post-production adapter pending',
      },
    ],
  },
  {
    id: 'openai', name: 'OpenAI', status: 'planned', credential: 'OPENAI_API_KEY',
    docs: 'https://platform.openai.com/docs',
    models: [{ id: 'sora', name: 'Sora', kind: 'video', tasks: ['text-to-video', 'image-to-video'], references: ['image'], nativeAudio: false, note: 'Adapter pending' }],
  },
  {
    id: 'runway-native', name: 'Runway native', status: 'planned', credential: 'RUNWAY_API_KEY',
    docs: 'https://docs.dev.runwayml.com/',
    models: [{ id: 'gen-4.5', name: 'Gen-4.5', kind: 'video', tasks: ['text-to-video', 'image-to-video'], references: ['image'], nativeAudio: true, note: 'Adapter pending' }],
  },
  {
    id: 'minimax', name: 'MiniMax', status: 'planned', credential: 'MINIMAX_API_KEY',
    docs: 'https://www.minimaxi.com/',
    models: [{ id: 'hailuo-video', name: 'MiniMax Video', kind: 'video', tasks: ['text-to-video', 'image-to-video'], references: ['image'], nativeAudio: false, note: 'Adapter pending' }],
  },
  {
    id: 'alibaba', name: 'Alibaba / Wan', status: 'planned', credential: 'WAN_API_KEY',
    docs: 'https://www.alibabacloud.com/help/en/model-studio/',
    models: [{ id: 'wan', name: 'Wan', kind: 'video', tasks: ['text-to-video', 'image-to-video'], references: ['image', 'video', 'audio'], nativeAudio: true, note: 'Adapter pending' }],
  },
  {
    id: 'luma', name: 'Luma', status: 'planned', credential: 'LUMA_API_KEY',
    docs: 'https://docs.lumalabs.ai/',
    models: [{ id: 'ray', name: 'Ray', kind: 'video', tasks: ['text-to-video', 'image-to-video'], references: ['image'], nativeAudio: false, note: 'Adapter pending' }],
  },
];

// UI controls and server validation share the same capability contract.
for (const m of MODELS.filter((m) => m.task === 'Video')) {
  m.capabilities = {
    durations: ['5', '10'],
    nativeAudio: true,
    nativeLanguages: ['en', 'zh'],
    maxImageReferences: m.fields.includes('start_image_url') ? 2 : 0,
  };
}
for (const mode of ['image-to-video', 'text-to-video']) {
  const image = mode === 'image-to-video';
  const m = model(
    'bytedance/seedance-2.5/' + mode,
    'Seedance 2.5 · ' + mode,
    'Video',
    'video',
    image
      ? 'Animate a start frame with an optional end frame. Native sound; 4–30 seconds.'
      : 'Generate video from text with native sound; 4–30 seconds.',
    {
      duration: '5',
      resolution: '720p',
      generate_audio: true,
      aspect_ratio: image ? 'auto' : '16:9',
      bitrate_mode: 'standard',
    },
    image ? ['image_url', 'end_image_url'] : [],
    {
      unit: 'resolution-second',
      rates: { '480p': 0.2205, '720p': 0.473, '1080p': 1.164 },
      verifiedAt: '2026-09-07',
    },
  );
  m.capabilities = {
    durations: Array.from({ length: 27 }, (_, i) => String(i + 4)),
    resolutions: ['480p', '720p', '1080p'],
    nativeAudio: true,
    maxImageReferences: image ? 2 : 0,
    bitrateModes: ['standard', 'high'],
  };
  MODELS.push(m);
}
// One-pass reference generation is the default for stylized speaking
// characters: the voice reference conditions motion and sound together,
// avoiding a second face-warping lip-sync pass.
const seedanceReference = model(
  'bytedance/seedance-2.5/reference-to-video',
  'Seedance 2.5 · reference to video',
  'Video',
  'video',
  'One-pass character, location and dialogue-reference video. Best for animated speaking characters; reference @Image1 and @Audio1 in the prompt.',
  {
    task: 'reference', duration: '5', resolution: '720p',
    generate_audio: true, aspect_ratio: '9:16', bitrate_mode: 'standard',
  },
  ['image_urls', 'video_urls', 'audio_urls'],
  { unit: 'resolution-second', rates: { '480p': 0.2205, '720p': 0.473, '1080p': 1.164 }, verifiedAt: '2026-09-17' },
);
seedanceReference.capabilities = {
  durations: Array.from({ length: 27 }, (_, i) => String(i + 4)),
  resolutions: ['480p', '720p', '1080p'], nativeAudio: true,
  maxImageReferences: 30, maxVideoReferences: 10, maxAudioReferences: 10,
  bitrateModes: ['standard', 'high'],
};
seedanceReference.recommendation = 'one-pass-speaking-animation';
MODELS.push(seedanceReference);
for (const mode of ['text-to-video', 'reference-to-video']) {
  const reference = mode === 'reference-to-video';
  const m = model(
    `bytedance/seedance-2.0/mini/${mode}`,
    `Seedance 2.0 Mini · ${reference ? 'reference to video' : 'text to video'}`,
    'Video',
    'video',
    reference
      ? 'Omni-modal Seedance Mini: up to 9 image, 3 video and 3 audio references. Mention them as @Image1, @Video1 and @Audio1 in the prompt; native sound, 4–15 seconds.'
      : 'Fast, lower-cost Seedance Mini exploration with native sound and 4–15 seconds.',
    {
      duration: '5',
      resolution: '720p',
      generate_audio: true,
      aspect_ratio: '16:9',
    },
    reference ? ['image_urls', 'video_urls', 'audio_urls'] : [],
    reference ? { unit: 'resolution-second', rates: { '480p': 0.0721, '720p': 0.1547 }, verifiedAt: '2026-09-25', source: 'https://fal.ai/models/bytedance/seedance-2.0/mini/reference-to-video' } : null,
  );
  m.capabilities = {
    durations: [
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '10',
      '11',
      '12',
      '13',
      '14',
      '15',
    ],
    resolutions: ['480p', '720p'],
    nativeAudio: true,
    nativeLanguages: ['en', 'zh'],
    maxImageReferences: reference ? 9 : 0,
    maxVideoReferences: reference ? 3 : 0,
    maxAudioReferences: reference ? 3 : 0,
  };
  m.recommendation = reference ? 'fast-consistent' : 'fast-exploration';
  MODELS.push(m);
}

// Verified against fal OpenAPI and model pricing, 2026-09-24.
for (const turbo of [false, true]) for (const image of [false, true]) {
  const family = turbo ? 'h3-max-turbo' : 'h3-max';
  const id = `minimax/${family}/${image ? 'image-to-video' : 'text-to-video'}`;
  const rates = turbo ? { '480P': 0.025, '768P': 0.04, '1080P': 0.08 } : { '480P': 0.05, '768P': 0.08, '1080P': 0.16 };
  const m = model(id, `MiniMax H3 Max${turbo ? ' Turbo · fast / lower cost' : ''} · ${image ? 'image to video' : 'text to video'} · fal`, 'Video', 'video',
    `${turbo ? 'Fast, lower-cost iteration. ' : ''}5–15 seconds, native sound always included. ${image ? 'First image required; optional second image controls the final frame. Canvas follows the image.' : 'Text only; supports portrait 9:16.'} 480P preview default. Speech quality requires review.`,
    { duration: '5', resolution: '480P', generate_audio: true, prompt_expansion_mode: 'disabled', ...(image ? {} : { aspect_ratio: '16:9' }) },
    image ? ['image_url', 'end_image_url'] : [],
    { unit: 'resolution-second', rates, promotionalRates: Object.fromEntries(Object.entries(rates).map(([k,v]) => [k,v/2])), promotionEndsAt: '2026-10-01T00:00:00Z', verifiedAt: '2026-09-24', source: `https://fal.ai/models/${id}` });
  m.capabilities = { durations: Array.from({length:11}, (_,i) => String(i+5)), resolutions: ['480P','768P','1080P'], nativeAudio: true, nativeAudioAlways: true, maxImageReferences: image ? 2 : 0, maxVideoReferences: 0, maxAudioReferences: 0 };
  m.recommendation = turbo ? 'fast-exploration' : 'balanced';
  MODELS.push(m);
}

// Multi-reference H3 route. Unlike image-to-video, every image here is a
// subject/location/style reference; the second image is not treated as an end
// frame. The first 4,096 reference tokens are included by the provider, which
// covers the normal two-character reference pack after preparation.
const h3Reference = model(
  'minimax/h3-max/reference-to-video',
  'MiniMax H3 Max · multi-reference video · fal',
  'Video',
  'video',
  'Cost-efficient multi-character video with native English dialogue. Accepts image, video and audio references as named subjects; 5–15 seconds.',
  { duration: '5', resolution: '768P', generate_audio: true, prompt_expansion_mode: 'balanced', aspect_ratio: '9:16' },
  ['reference_image_urls', 'reference_video_urls', 'reference_audio_urls'],
  { unit: 'resolution-second', rates: { '480P': 0.05, '768P': 0.08, '1080P': 0.16 }, verifiedAt: '2026-09-25', source: 'https://fal.ai/models/minimax/h3-max/reference-to-video', referenceAllowanceTokens: 4096 },
);
h3Reference.capabilities = {
  durations: Array.from({ length: 11 }, (_, i) => String(i + 5)),
  resolutions: ['480P', '768P', '1080P'],
  nativeAudio: true,
  nativeAudioAlways: true,
  maxImageReferences: 16,
  maxVideoReferences: 8,
  maxAudioReferences: 8,
};
h3Reference.recommendation = 'cost-efficient-multi-reference';
MODELS.push(h3Reference);

// Runway Dev adapters. They use the same workflow contract as FAL while the
// provider-specific request mapping lives in generation.mjs.
for (const spec of [
  {
    id: 'runway/h3_max', name: 'MiniMax H3 Max · Runway Dev',
    fields: ['image_url', 'end_image_url'], durations: Array.from({ length: 11 }, (_, i) => String(i + 5)),
    resolutions: ['480p', '768p'], refs: 2,
    description: 'Runway Dev text/image to video with first/last frame control and native audio.',
  },
  {
    id: 'runway/wan3_prime', name: 'WAN 3.0 Prime · Runway Dev',
    fields: ['image_urls', 'video_urls', 'audio_urls'], durations: Array.from({ length: 29 }, (_, i) => String(i + 2)),
    resolutions: ['480p', '720p', '1080p'], refs: 9,
    description: 'Runway Dev reference-driven video with image, video and audio inputs and native sound.',
  },
]) {
  const m = {
    id: spec.id, name: spec.name, provider: 'runway', task: 'Video', kind: 'video',
    description: spec.description, defaults: { duration: '5', resolution: spec.resolutions[0], generate_audio: true, aspect_ratio: '16:9' },
    fields: spec.fields, pricing: null, docs: 'https://docs.dev.runwayml.com/',
    capabilities: { durations: spec.durations, resolutions: spec.resolutions, nativeAudio: true, maxImageReferences: spec.refs, maxVideoReferences: spec.id.includes('wan3') ? 3 : 0, maxAudioReferences: spec.id.includes('wan3') ? 3 : 0 },
    requiresKey: 'RUNWAY_API_KEY', adapter: 'runway',
  };
  MODELS.push(m);
}
export function getModel(id) {
  const m = MODELS.find((m) => m.id === id);
  if (!m) fail('Choose a supported model.');
  return m;
}
const referenceFields = {
  image: ['image_url', 'image_urls', 'reference_image_urls', 'start_image_url', 'end_image_url'],
  video: ['video_url', 'video_urls', 'reference_video_urls'],
  audio: ['audio_url', 'audio_urls', 'reference_audio_urls'],
};
const capabilityName = {
  image: 'maxImageReferences',
  video: 'maxVideoReferences',
  audio: 'maxAudioReferences',
};
export function referenceCapacity(m, kind) {
  const fields = referenceFields[kind] || [];
  if (!fields.some((field) => m.fields.includes(field))) return 0;
  const configured = m.capabilities?.[capabilityName[kind]];
  if (configured != null) return configured;
  const plural = `${kind}_urls`;
  if (m.fields.includes(plural)) return null;
  if (kind === 'image' && m.fields.includes('end_image_url')) return 2;
  return 1;
}
export function supportedDuration(m, requested) {
  const wanted = Number(requested);
  const values = (m.capabilities?.durations || [])
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (!Number.isFinite(wanted) || wanted <= 0 || !values.length)
    fail('A supported generation duration is required.');
  const chosen = values.find((value) => value >= wanted);
  if (chosen == null)
    fail(`${m.name} cannot cover a ${wanted}-second shot in one generation.`);
  return String(chosen);
}
export function buildInput(m, prompt, options = {}) {
  const input = { ...m.defaults };
  if (m.task === 'Lip-sync') {
    for (const k of ['video_url', 'audio_url']) input[k] = options[k];
    const leadIn = Number(options.speech_start_seconds || 0);
    if (!Number.isFinite(leadIn) || leadIn < 0 || leadIn > 30)
      fail('Speech start must be between 0 and 30 seconds.');
    input.speech_start_seconds = leadIn;
  } else if (m.task === 'Avatar lip-sync') {
    input.image_url = options.image_url;
    input.audio_url = options.audio_url;
  } else if (m.task === 'Dialogue / voice') {
    input.text = prompt;
    if (options.voice) input.voice = String(options.voice);
    if (options.language_code) {
      if (!/^[a-z]{2}$/.test(options.language_code))
        fail('Use a two-letter speech language code.');
      input.language_code = options.language_code;
    }
    input.timestamps = true;
  } else {
    input.prompt = prompt;
    if (m.kind === 'image') {
      if ('aspect_ratio' in input && options.aspect_ratio)
        input.aspect_ratio = options.aspect_ratio;
      if (options.seed !== undefined && options.seed !== '')
        input.seed = number(options.seed, 0, 2147483647, 'Seed');
      for (const field of ['image_urls', 'video_urls', 'audio_urls', 'reference_image_urls', 'reference_video_urls', 'reference_audio_urls'])
        if (m.fields.includes(field)) input[field] = options[field];
      if (options.image_size) input.image_size = options.image_size;
      if (m.fields.includes('image_url')) input.image_url = options.image_url;
      if (options.negative_prompt && m.id.includes('qwen'))
        input.negative_prompt = String(options.negative_prompt).slice(0, 4000);
    }
    if (m.task === 'Video') {
      const duration = String(options.duration ?? m.defaults.duration);
      if (!m.capabilities.durations.includes(duration))
        fail(
          m.name +
            ' requires ' +
            m.capabilities.durations.join(' or ') +
            ' seconds.',
        );
      input.duration = duration;
      input.generate_audio =
        options.generate_audio ?? m.defaults.generate_audio;
      if (typeof input.generate_audio !== 'boolean')
        fail('Audio setting must be boolean.');
      for (const field of ['image_urls', 'video_urls', 'audio_urls', 'reference_image_urls', 'reference_video_urls', 'reference_audio_urls'])
        if (m.fields.includes(field)) input[field] = options[field];
      const startField = m.fields.includes('image_url')
        ? 'image_url'
        : m.fields.includes('start_image_url')
          ? 'start_image_url'
          : null;
      if (startField) {
        input[startField] = options[startField];
        if (options.end_image_url) input.end_image_url = options.end_image_url;
      } else {
        const ratio =
          options.aspect_ratio === '2.39:1' ? '21:9' : options.aspect_ratio;
        const ratios = m.capabilities.resolutions
          ? ['16:9', '9:16', '1:1', '21:9', '4:3', '3:4']
          : ['16:9', '9:16', '1:1'];
        if (ratio && !ratios.includes(ratio))
          fail('Unsupported aspect ratio for this model.');
        input.aspect_ratio = ratio || '16:9';
      }
      if (m.capabilities.resolutions) {
        input.resolution = options.resolution ?? m.defaults.resolution;
        if (!m.capabilities.resolutions.includes(input.resolution))
          fail('Unsupported resolution.');
        if (m.capabilities.bitrateModes) {
          input.bitrate_mode = options.bitrate_mode ?? m.defaults.bitrate_mode;
          if (!m.capabilities.bitrateModes.includes(input.bitrate_mode))
            fail('Unsupported bitrate mode.');
        }
      } else if (options.negative_prompt)
        input.negative_prompt = String(options.negative_prompt);
    }
    if (m.task === 'Music / sound effects')
      input.seconds_total = number(
        options.seconds_total || 30,
        1,
        190,
        'Audio duration',
      );
  }
  for (const k of [
    'image_urls',
    'start_image_url',
    'image_url',
    'video_url',
    'audio_url',
  ].filter((k) => m.fields.includes(k))) {
    const v = input[k];
    if (k === 'image_urls' || k === 'reference_image_urls') {
      const max = m.capabilities?.maxImageReferences ?? 4;
      if (!Array.isArray(v) || !v.length || v.length > max)
        fail(`Choose one to ${max === 4 ? 'four' : max} image references.`);
    } else if (!v) fail(`${k.replaceAll('_', ' ')} is required.`);
  }
  if (m.id === 'minimax/h3-max/reference-to-video') {
    const referenceCount = ['reference_image_urls', 'reference_video_urls', 'reference_audio_urls']
      .reduce((total, field) => total + (Array.isArray(input[field]) ? input[field].length : 0), 0);
    if (!referenceCount) fail('Choose at least one image, video, or audio reference.');
  }
  if (m.id.startsWith('minimax/h3-max')) {
    // These routes generate native audio unconditionally; generate_audio is
    // a portal option, not a supported fal payload field.
    delete input.generate_audio;
    input.duration = Number(input.duration);
    if (options.seed !== undefined && options.seed !== '') input.seed = number(options.seed, 0, 2147483647, 'Seed');
  }
  return input;
}
export function estimate(m, input, at = Date.now()) {
  if (!m.pricing) return null;
  if (m.pricing.unit === 'resolution-second')
    return (
      Math.round(
        Number(input.duration) * (m.pricing.promotionalRates && at < Date.parse(m.pricing.promotionEndsAt) ? m.pricing.promotionalRates : m.pricing.rates)[input.resolution] * 1000000,
      ) / 1000000
    );
  if (m.pricing.unit === 'second')
    return (
      Math.round(
        Number(input.duration) *
          (input.generate_audio ? m.pricing.audio : m.pricing.silent) *
          1000000,
      ) / 1000000
    );
  if (m.pricing.unit === 'character') return input.text.length * m.pricing.rate;
  return m.pricing.rate;
}
