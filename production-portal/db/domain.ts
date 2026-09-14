/** Shared, serialisable Film OS contracts. Keep provider SDKs and secrets out. */
export const CANONICAL_ASSET_KINDS = ['character', 'location', 'prop', 'wardrobe', 'style'] as const;
export const ASSET_STATUSES = ['draft', 'review', 'approved', 'rejected', 'superseded'] as const;
export const SHOT_SELECTION_ROLES = ['subject', 'location', 'prop', 'wardrobe', 'style_reference', 'start_frame', 'end_frame'] as const;
export const REVIEW_VERDICTS = ['approve', 'revise', 'reject'] as const;
export const RUN_STATUSES = ['queued', 'submitted', 'running', 'succeeded', 'failed', 'cancelled'] as const;
export const JOB_STATUSES = ['queued', 'submitted', 'running', 'succeeded', 'failed', 'cancelled'] as const;

/**
 * Server-side lifecycle rules. Keeping these transitions in one serialisable
 * module prevents route handlers from accidentally allowing a paid job to be
 * re-submitted, or a terminal result to move backwards.
 */
export const STATUS_TRANSITIONS = {
  asset: {
    draft: ['review', 'rejected'],
    review: ['approved', 'rejected'],
    approved: ['superseded'],
    rejected: ['draft', 'review'],
    superseded: [],
  },
  run: {
    queued: ['submitted', 'cancelled'],
    submitted: ['running', 'failed', 'cancelled'],
    running: ['succeeded', 'failed', 'cancelled'],
    succeeded: [],
    failed: ['queued'],
    cancelled: [],
  },
  job: {
    queued: ['submitted', 'cancelled'],
    submitted: ['running', 'failed', 'cancelled'],
    running: ['succeeded', 'failed', 'cancelled'],
    succeeded: [],
    failed: ['queued'],
    cancelled: [],
  },
} as const;

export type StatusEntity = keyof typeof STATUS_TRANSITIONS;
export type LifecycleStatus = AssetStatus | RunStatus | JobStatus;

export function canTransitionStatus(entity: StatusEntity, from: string, to: string): boolean {
  if (from === to) return true;
  const transitions = STATUS_TRANSITIONS[entity] as Record<string, readonly string[]>;
  return transitions[from]?.includes(to) ?? false;
}

export function assertStatusTransition(entity: StatusEntity, from: string, to: string): void {
  if (!canTransitionStatus(entity, from, to)) {
    throw new Error(`Invalid ${entity} status transition: ${from} -> ${to}`);
  }
}

/** Idempotency keys are opaque client values, but must be bounded and safe to log/index. */
export function assertIdempotencyKey(value: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$/.test(value)) {
    throw new Error('Idempotency key must be 8-200 characters and contain only safe token characters.');
  }
}

/** A quote/approval may only authorize work while its exact quote is current. */
export function isApprovalUsable(snapshot: PaidApprovalSnapshot, now = new Date()): boolean {
  return Boolean(snapshot.quoteId && snapshot.quotePayloadHash && snapshot.provider && snapshot.model)
    && Number.isFinite(Date.parse(snapshot.expiresAt))
    && Date.parse(snapshot.expiresAt) > now.getTime();
}

export type CanonicalAssetKind = (typeof CANONICAL_ASSET_KINDS)[number];
export type AssetStatus = (typeof ASSET_STATUSES)[number];
export type ShotSelectionRole = (typeof SHOT_SELECTION_ROLES)[number];
export type ReviewVerdict = (typeof REVIEW_VERDICTS)[number];
export type RunStatus = (typeof RUN_STATUSES)[number];
export type JobStatus = (typeof JOB_STATUSES)[number];
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface AssetReference {
  canonicalAssetId: string;
  revisionAssetId?: string;
  role: ShotSelectionRole;
  locked: boolean;
}

export interface GenerationRequestSnapshot {
  prompt: string;
  negativePrompt?: string;
  durationSeconds?: number;
  aspectRatio?: string;
  audioMode: 'none' | 'native' | 'post';
  modelInput: Record<string, JsonValue>;
  references: AssetReference[];
  continuity: Record<string, JsonValue>;
}

export interface PaidApprovalSnapshot {
  quoteId: string;
  quotePayloadHash: string;
  provider: string;
  model: string;
  maxCostUsd: string;
  expiresAt: string;
  requestedOperation: 'generate_image' | 'generate_video' | 'generate_audio' | 'upscale' | 'render_delivery';
}

export interface DeliveryManifest {
  timelineVersion: string;
  items: Array<{ shotId: string; assetId: string; inMs: number; outMs: number }>;
  transitions: Array<{ afterShotId: string; type: string; durationMs: number }>;
  audioPolicy: 'none' | 'dialogue_and_sfx' | 'mixed';
}

export function isOneOf<T extends readonly string[]>(value: string, values: T): value is T[number] {
  return (values as readonly string[]).includes(value);
}

export function assertSafeProviderSnapshot(snapshot: GenerationRequestSnapshot): void {
  const encoded = JSON.stringify(snapshot).toLowerCase();
  const forbidden = ['fal_key', 'api_key', 'authorization:', 'bearer ', 'secret'];
  if (forbidden.some((term) => encoded.includes(term))) {
    throw new Error('Provider snapshots must not contain credentials or authorization headers.');
  }
}
