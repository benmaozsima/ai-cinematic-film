export type CanonicalStatus = 'approved' | 'review' | 'draft' | 'blocked';
export type AssetKind = 'character' | 'prop' | 'location';

/** A record that can safely become part of a reproducible generation package. */
export type FilmAsset = {
  id: string;
  kind: AssetKind;
  name: string;
  /** Short, production-facing identity note — never an AI-generated replacement. */
  continuityNote: string;
  status: CanonicalStatus;
  referenceUrl?: string;
  thumbnailUrl?: string;
  ownerCharacterId?: string;
  usedInShotIds?: string[];
  version?: string;
};

export type BuilderDraft = {
  shotId: string;
  intent: string;
  characterIds: string[];
  propIds: string[];
  locationId?: string;
  visualDirection: string;
  audioMode: 'silent' | 'ambience' | 'dialogue' | 'native-audio';
  audioDirection: string;
  selectedModelId?: string;
};

export type ModelHandoff = {
  modelId: string;
  modelLabel: string;
  provider: string;
  estimatedCost?: string;
  supportsNativeAudio?: boolean;
};
