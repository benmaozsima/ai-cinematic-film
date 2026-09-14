/**
 * Canonical model catalog for the production portal.
 *
 * This file is intentionally UI-agnostic.  Screens can use the same catalog
 * for model selection, capability gating, quote previews and run records.  A
 * provider adapter should validate the model id and pricing again server-side
 * before submitting a paid request.
 */

export type ModelProvider = 'Fal' | 'Replicate' | 'Runway' | (string & {});

export type ModelCapability =
  | 'text-to-image'
  | 'image-to-image'
  | 'text-to-video'
  | 'image-to-video'
  | 'reference-to-video'
  | 'start-frame'
  | 'end-frame'
  | 'multi-reference'
  | 'native-audio'
  | 'audio-conditioning'
  | 'lip-sync'
  | 'video-to-video'
  | 'upscale'
  | 'identity-preservation'
  | 'dialogue';

export type AudioMode = 'silent' | 'native-audio' | 'conditioned-audio' | 'lip-sync' | 'post-lip-sync';

export type ModelInput =
  | 'prompt'
  | 'image'
  | 'video'
  | 'start-frame'
  | 'end-frame'
  | 'references'
  | 'audio'
  | 'mask';

export interface ModelRegistryEntry {
  /** Stable provider model id used by the server adapter. */
  id: string;
  provider: ModelProvider;
  label: string;
  description: string;
  capabilities: readonly ModelCapability[];
  inputs: readonly ModelInput[];
  audioMode: AudioMode;
  estimatedCost: string;
  /** Optional practical limits surfaced by the UI before a run is created. */
  limits?: {
    maxReferences?: number;
    maxDurationSeconds?: number;
    supportedAspectRatios?: readonly string[];
  };
  /** Allows the catalog to distinguish an experimental/optional integration. */
  status?: 'available' | 'experimental' | 'disabled';
}

/**
 * Legacy shape used by the original portal screens:
 * [model id, label, description, estimated cost, audio mode].
 * Keep this export while screens migrate to ModelRegistryEntry.
 */
export type LegacyFalModelTuple = readonly [
  id: string,
  label: string,
  description: string,
  estimatedCost: string,
  audioMode: AudioMode,
];

const ratios = ['9:16', '16:9', '1:1'] as const;

export const modelRegistry: readonly ModelRegistryEntry[] = [
  {
    id: 'bytedance/seedance-2.5/reference-to-video',
    provider: 'Fal',
    label: 'Seedance 2.5 · Reference to Video',
    description: 'עד 50 רפרנסים: דמויות, לוקיישן, וידאו ואודיו; continuity ארוך',
    capabilities: ['reference-to-video', 'multi-reference', 'identity-preservation', 'native-audio', 'dialogue'],
    inputs: ['prompt', 'references', 'video', 'audio'],
    audioMode: 'native-audio',
    estimatedCost: '~$0.2205/s 480p · ~$0.4730/s 720p',
    limits: { maxReferences: 50, maxDurationSeconds: 30, supportedAspectRatios: ratios },
  },
  {
    id: 'bytedance/seedance-2.5/image-to-video',
    provider: 'Fal',
    label: 'Seedance 2.5 · Image to Video',
    description: 'start/end frame · עד 30 שניות · native audio',
    capabilities: ['image-to-video', 'start-frame', 'end-frame', 'native-audio', 'dialogue'],
    inputs: ['prompt', 'image', 'start-frame', 'end-frame'],
    audioMode: 'native-audio',
    estimatedCost: '$0.0214 / 1K output tokens',
    limits: { maxDurationSeconds: 30, supportedAspectRatios: ratios },
  },
  {
    id: 'bytedance/seedance-2.5/text-to-video',
    provider: 'Fal',
    label: 'Seedance 2.5 · Text to Video',
    description: 'טייק אחד עד 30 שניות · native audio',
    capabilities: ['text-to-video', 'native-audio', 'dialogue'],
    inputs: ['prompt'],
    audioMode: 'native-audio',
    estimatedCost: '$0.0214 / 1K output tokens',
    limits: { maxDurationSeconds: 30, supportedAspectRatios: ratios },
  },
  {
    id: 'bytedance/seedance-2.0/image-to-video',
    provider: 'Fal',
    label: 'Seedance 2 · Image to Video',
    description: 'I2V · native audio / lip-sync · start/end frame',
    capabilities: ['image-to-video', 'start-frame', 'end-frame', 'native-audio', 'lip-sync', 'dialogue'],
    inputs: ['prompt', 'image', 'start-frame', 'end-frame', 'audio'],
    audioMode: 'native-audio',
    estimatedCost: '$0.3034/s',
    limits: { maxDurationSeconds: 30, supportedAspectRatios: ratios },
  },
  {
    id: 'bytedance/seedance-2.0/fast/image-to-video',
    provider: 'Fal',
    label: 'Seedance 2 Fast · Image to Video',
    description: 'I2V · 720p · native audio',
    capabilities: ['image-to-video', 'native-audio'],
    inputs: ['prompt', 'image'],
    audioMode: 'native-audio',
    estimatedCost: '$0.2419/s',
    limits: { maxDurationSeconds: 30, supportedAspectRatios: ratios },
  },
  {
    id: 'bytedance/seedance-2.0/fast/reference-to-video',
    provider: 'Fal',
    label: 'Seedance 2 Fast · Reference to Video',
    description: 'up to 9 images + video/audio references',
    capabilities: ['reference-to-video', 'multi-reference', 'native-audio'],
    inputs: ['prompt', 'references', 'video', 'audio'],
    audioMode: 'native-audio',
    estimatedCost: '$0.2419/s',
    limits: { maxReferences: 9, maxDurationSeconds: 30, supportedAspectRatios: ratios },
  },
  {
    id: 'fal-ai/kling-video/v3/pro/image-to-video',
    provider: 'Fal',
    label: 'Kling 3 Pro · Image to Video',
    description: 'I2V · end frame · multi-speaker native audio',
    capabilities: ['image-to-video', 'end-frame', 'native-audio', 'dialogue'],
    inputs: ['prompt', 'image', 'end-frame'],
    audioMode: 'native-audio',
    estimatedCost: '$0.112–0.168/s',
    limits: { maxDurationSeconds: 15, supportedAspectRatios: ratios },
  },
  {
    id: 'fal-ai/kling-video/v2.5-turbo/standard/image-to-video',
    provider: 'Fal',
    label: 'Kling 2.5 Turbo · I2V',
    description: 'economical controlled motion · silent pass',
    capabilities: ['image-to-video'],
    inputs: ['prompt', 'image'],
    audioMode: 'silent',
    estimatedCost: 'see provider quote',
    limits: { maxDurationSeconds: 10, supportedAspectRatios: ratios },
  },
  {
    id: 'fal-ai/wan-25-preview/image-to-video',
    provider: 'Fal',
    label: 'Wan 2.5 · Image to Video',
    description: 'I2V with optional audio conditioning',
    capabilities: ['image-to-video', 'audio-conditioning'],
    inputs: ['prompt', 'image', 'audio'],
    audioMode: 'conditioned-audio',
    estimatedCost: 'see provider quote',
    limits: { maxDurationSeconds: 10, supportedAspectRatios: ratios },
  },
  {
    id: 'fal-ai/ovi/image-to-video',
    provider: 'Fal',
    label: 'Ovi · Image to Audio Video',
    description: 'I2V with generated audio',
    capabilities: ['image-to-video', 'native-audio'],
    inputs: ['prompt', 'image'],
    audioMode: 'native-audio',
    estimatedCost: '$0.20/video',
    limits: { maxDurationSeconds: 10, supportedAspectRatios: ratios },
  },
  {
    id: 'fal-ai/sync-lipsync/v3/image-to-video',
    provider: 'Fal',
    label: 'Sync 3 Avatar · Lip-sync',
    description: 'still image + supplied voice audio → lipsynced clip',
    capabilities: ['image-to-video', 'lip-sync', 'dialogue'],
    inputs: ['image', 'audio'],
    audioMode: 'lip-sync',
    estimatedCost: '$0.1333/s',
    limits: { maxDurationSeconds: 30, supportedAspectRatios: ratios },
  },
  {
    id: 'fal-ai/kling-video/lipsync/audio-to-video',
    provider: 'Fal',
    label: 'Kling LipSync · Audio to Video',
    description: 'apply voice track to existing video',
    capabilities: ['video-to-video', 'lip-sync', 'dialogue'],
    inputs: ['video', 'audio'],
    audioMode: 'post-lip-sync',
    estimatedCost: 'see provider quote',
  },
  {
    id: 'fal-ai/flashtalk',
    provider: 'Fal',
    label: 'Flashtalk · Talking Head',
    description: 'face image + voice audio → lipsynced clip',
    capabilities: ['image-to-video', 'lip-sync', 'dialogue'],
    inputs: ['image', 'audio'],
    audioMode: 'lip-sync',
    estimatedCost: 'see provider quote',
    limits: { maxDurationSeconds: 30, supportedAspectRatios: ratios },
  },
  {
    id: 'fal-ai/bytedance-upscaler/upscale/video',
    provider: 'Fal',
    label: 'ByteDance Video Upscaler',
    description: 'post-production upscale; fidelity is an upscale setting',
    capabilities: ['upscale'],
    inputs: ['video'],
    audioMode: 'silent',
    estimatedCost: 'see provider quote',
    status: 'available',
  },
];

/** Exact compatibility projection for the legacy `falModels` UI shape. */
export const falModels: readonly LegacyFalModelTuple[] = modelRegistry
  .filter((model) => model.provider === 'Fal')
  .map((model) => [model.id, model.label, model.description, model.estimatedCost, model.audioMode] as const);

export function getModel(modelId: string): ModelRegistryEntry | undefined {
  return modelRegistry.find((model) => model.id === modelId);
}

export function modelsWithCapability(capability: ModelCapability): readonly ModelRegistryEntry[] {
  return modelRegistry.filter((model) => model.capabilities.includes(capability));
}

export function supportsAll(modelId: string, capabilities: readonly ModelCapability[]): boolean {
  const model = getModel(modelId);
  return Boolean(model && capabilities.every((capability) => model.capabilities.includes(capability)));
}
