import type { FilmOSShot } from '../types';

export type FilmOSCapability = 'identity' | 'references' | 'dialogue' | 'audio' | 'end-frame' | 'speed' | 'upscale';
export type FilmOSAudioPath = 'silent' | 'native-audio' | 'post-lipsync';
export type FilmOSModelRisk = 'low' | 'medium' | 'high';

/** Provider-neutral model registry entry. Provider adapters resolve the ID server-side. */
export type FilmOSModelOption = {
  id: string;
  provider: string;
  name: string;
  summary: string;
  capabilities: FilmOSCapability[];
  audioPaths: FilmOSAudioPath[];
  estimatedCost: string;
  risk: FilmOSModelRisk;
  maxReferences?: number;
  maxDurationSeconds?: number;
  note?: string;
};

export type FilmOSGenerationNeed = {
  hasApprovedReferences?: boolean;
  needsCharacterLock?: boolean;
  needsDialogue?: boolean;
  needsEndFrame?: boolean;
  needsFastIteration?: boolean;
  outputSeconds?: number;
};

export type FilmOSApprovalSummary = {
  kind: 'generation' | 'export';
  provider?: string;
  model?: string;
  selectedShotIds: string[];
  estimatedCost?: string;
  notes: string[];
};

export type FilmOSModelLabProps = {
  models: FilmOSModelOption[];
  need?: FilmOSGenerationNeed;
  selectedModelId?: string;
  onSelectModel?: (model: FilmOSModelOption) => void;
  /** Opens the host application's explicit approval dialog. This component never calls a provider. */
  onRequestApproval?: (summary: FilmOSApprovalSummary) => void;
};

export type FilmOSDeliveryProps = {
  shots: FilmOSShot[];
  selectedVersions?: Record<string, string>;
  durableMp4Url?: string;
  durableMp4Label?: string;
  onRequestExportApproval?: (summary: FilmOSApprovalSummary) => void;
};
