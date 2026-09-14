import type { FilmOSShot, FilmOSStatus } from '../types';

/** A decision may be recorded only after a human review; it is never inferred from media. */
export type FilmOSReviewDecision = 'approved' | 'revise' | 'rejected';

export type FilmOSQcCheckKey =
  | 'identity'
  | 'props'
  | 'anatomy'
  | 'action'
  | 'continuity'
  | 'audio';

export type FilmOSQcChecklist = Partial<Record<FilmOSQcCheckKey, boolean>>;

/** A concrete render variant. `videoUrl` must point to a real playable media asset. */
export type FilmOSReviewVariant = {
  id: string;
  label: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  status?: FilmOSStatus;
  createdAt?: string;
  model?: string;
  durationSeconds?: number;
};

/** Immutable data captured at generation time. Omit fields that were never recorded. */
export type FilmOSRunRecord = {
  runId: string;
  provider?: string;
  model?: string;
  createdAt?: string;
  prompt?: string;
  constraints?: string[];
  referenceAssetIds?: string[];
  outputAssetId?: string;
  sha256?: string;
  costUsd?: number;
};

export type FilmOSReviewItem = {
  shot: FilmOSShot;
  variants: FilmOSReviewVariant[];
  selectedVariantId?: string;
  checklist?: FilmOSQcChecklist;
  runRecord?: FilmOSRunRecord;
  note?: string;
};

export type FilmOSReviewWorkbenchProps = {
  /** Reviewable shots. Passing an empty array intentionally renders an empty-state, never mock media. */
  items: FilmOSReviewItem[];
  selectedShotId?: string;
  onSelectItem?: (item: FilmOSReviewItem) => void;
  onSelectVariant?: (item: FilmOSReviewItem, variant: FilmOSReviewVariant) => void;
  onChecklistChange?: (item: FilmOSReviewItem, checklist: FilmOSQcChecklist) => void;
  onDecision?: (item: FilmOSReviewItem, decision: FilmOSReviewDecision, variant?: FilmOSReviewVariant, note?: string) => void;
};
