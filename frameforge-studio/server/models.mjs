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
    null,
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
    { model: 'lipsync-2', sync_mode: 'cut_off' },
    ['video_url', 'audio_url'],
    null,
  ),
];

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
    null,
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
export function buildInput(m, prompt, options = {}) {
  const input = { ...m.defaults };
  if (m.task === 'Lip-sync') {
    for (const k of ['video_url', 'audio_url']) input[k] = options[k];
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
      if (m.fields.includes('image_urls'))
        input.image_urls = options.image_urls;
      if (m.fields.includes('video_urls')) input.video_urls = options.video_urls;
      if (m.fields.includes('audio_urls')) input.audio_urls = options.audio_urls;
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
      if (m.fields.includes('image_urls'))
        input.image_urls = options.image_urls;
      if (m.fields.includes('video_urls')) input.video_urls = options.video_urls;
      if (m.fields.includes('audio_urls')) input.audio_urls = options.audio_urls;
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
    if (k === 'image_urls') {
      const max = m.capabilities?.maxImageReferences || 4;
      if (!Array.isArray(v) || !v.length || v.length > max)
        fail(`Choose one to ${max === 4 ? 'four' : max} image references.`);
    } else if (!v) fail(`${k.replaceAll('_', ' ')} is required.`);
  }
  return input;
}
export function estimate(m, input) {
  if (!m.pricing) return null;
  if (m.pricing.unit === 'resolution-second')
    return (
      Math.round(
        Number(input.duration) * m.pricing.rates[input.resolution] * 1000000,
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
