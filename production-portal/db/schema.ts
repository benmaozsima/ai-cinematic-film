import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * D1 persistence for Film OS. Binary media is never stored in D1: R2 holds
 * original files while this database holds immutable provenance and decisions.
 * Status/type columns are validated by db/domain.ts at the API boundary.
 */
const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
};

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  canonicalVersion: text('canonical_version').notNull(),
  status: text('status').notNull().default('active'),
  settingsJson: text('settings_json').notNull().default('{}'),
  createdAt: timestamps.createdAt,
  updatedAt: timestamps.updatedAt,
});

/** Persistent CHAR_/LOC_/PROP_ identities; never use a model's ephemeral ID. */
export const canonicalAssets = sqliteTable('canonical_assets', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  kind: text('kind').notNull(),
  canonicalLabel: text('canonical_label').notNull(),
  internalLabel: text('internal_label'),
  status: text('status').notNull().default('draft'),
  constraintsJson: text('constraints_json').notNull().default('{}'),
  currentRevisionId: text('current_revision_id'),
  createdAt: timestamps.createdAt,
  updatedAt: timestamps.updatedAt,
}, (table) => [
  uniqueIndex('canonical_assets_project_label_unique').on(table.projectId, table.canonicalLabel),
  index('canonical_assets_project_kind_idx').on(table.projectId, table.kind),
]);

/** Versioned files/metadata. `assets` is retained as the media artifact record. */
export const assets = sqliteTable('assets', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  canonicalAssetId: text('canonical_asset_id'),
  shotId: text('shot_id'),
  type: text('type').notNull(),
  version: text('version').notNull(),
  status: text('status').notNull(),
  storageKey: text('storage_key'),
  mediaUrl: text('media_url'),
  mimeType: text('mime_type'),
  byteSize: integer('byte_size'),
  width: integer('width'),
  height: integer('height'),
  durationMs: integer('duration_ms'),
  sha256: text('sha256'),
  promptSnapshotJson: text('prompt_snapshot_json'),
  lineageJson: text('lineage_json').notNull(),
  createdAt: timestamps.createdAt,
  updatedAt: timestamps.updatedAt,
}, (table) => [
  uniqueIndex('assets_project_storage_key_unique').on(table.projectId, table.storageKey),
  index('assets_project_shot_idx').on(table.projectId, table.shotId),
  index('assets_canonical_asset_idx').on(table.canonicalAssetId),
]);

/** Ordered shot configuration; selections always point at canonical asset IDs. */
export const shots = sqliteTable('shots', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  sequenceNo: integer('sequence_no').notNull(),
  title: text('title').notNull(),
  durationMs: integer('duration_ms').notNull(),
  status: text('status').notNull().default('planned'),
  briefJson: text('brief_json').notNull().default('{}'),
  continuityJson: text('continuity_json').notNull().default('{}'),
  createdAt: timestamps.createdAt,
  updatedAt: timestamps.updatedAt,
}, (table) => [
  uniqueIndex('shots_project_sequence_unique').on(table.projectId, table.sequenceNo),
]);

export const shotSelections = sqliteTable('shot_selections', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  shotId: text('shot_id').notNull(),
  canonicalAssetId: text('canonical_asset_id').notNull(),
  assetRevisionId: text('asset_revision_id'),
  role: text('role').notNull(),
  locked: integer('locked', { mode: 'boolean' }).notNull().default(false),
  notes: text('notes'),
  createdAt: timestamps.createdAt,
  updatedAt: timestamps.updatedAt,
}, (table) => [
  uniqueIndex('shot_selections_unique_role').on(table.shotId, table.canonicalAssetId, table.role),
  index('shot_selections_shot_idx').on(table.shotId),
]);

/** A quote captures the exact pre-charge request and expires before approval. */
export const quotes = sqliteTable('quotes', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  payloadHash: text('payload_hash').notNull(),
  payloadJson: text('payload_json').notNull(),
  maxCostUsd: text('max_cost_usd').notNull(),
  currency: text('currency').notNull().default('USD'),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: timestamps.createdAt,
});

/** Insert-only record of a specific user authorising a quoted operation. */
export const paidApprovals = sqliteTable('paid_approvals', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  quoteId: text('quote_id').notNull(),
  quotePayloadHash: text('quote_payload_hash').notNull(),
  approvalSnapshotJson: text('approval_snapshot_json').notNull(),
  actorId: text('actor_id').notNull(),
  idempotencyKey: text('idempotency_key').notNull(),
  approvedAt: integer('approved_at', { mode: 'timestamp' }).notNull(),
  createdAt: timestamps.createdAt,
}, (table) => [
  uniqueIndex('paid_approvals_idempotency_unique').on(table.projectId, table.idempotencyKey),
  index('paid_approvals_quote_idx').on(table.quoteId),
]);

/** Immutable generation input + provider response metadata; never includes secrets. */
export const generationRuns = sqliteTable('generation_runs', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  shotId: text('shot_id'),
  approvalId: text('approval_id'),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  requestHash: text('request_hash').notNull(),
  requestSnapshotJson: text('request_snapshot_json').notNull(),
  referenceSnapshotJson: text('reference_snapshot_json').notNull().default('[]'),
  status: text('status').notNull().default('queued'),
  providerRequestId: text('provider_request_id'),
  providerResponseJson: text('provider_response_json'),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  createdAt: timestamps.createdAt,
  updatedAt: timestamps.updatedAt,
}, (table) => [
  uniqueIndex('generation_runs_request_unique').on(table.projectId, table.requestHash),
  index('generation_runs_shot_idx').on(table.shotId),
  index('generation_runs_approval_idx').on(table.approvalId),
]);

/** Background job state only; the provider adapter owns any external request. */
export const jobs = sqliteTable('jobs', {
  id: text('id').primaryKey(),
  quoteId: text('quote_id').notNull(),
  runId: text('run_id'),
  status: text('status').notNull(),
  providerRequestId: text('provider_request_id'),
  actualCostUsd: text('actual_cost_usd'),
  resultAssetId: text('result_asset_id'),
  retryCount: integer('retry_count').notNull().default(0),
  lastErrorCode: text('last_error_code'),
  lastErrorSafeMessage: text('last_error_safe_message'),
  createdAt: timestamps.createdAt,
  updatedAt: timestamps.updatedAt,
}, (table) => [index('jobs_run_idx').on(table.runId)]);

/** A review is an append-only human/automated decision about one asset revision. */
export const reviews = sqliteTable('reviews', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  assetId: text('asset_id').notNull(),
  runId: text('run_id'),
  reviewerId: text('reviewer_id').notNull(),
  reviewerKind: text('reviewer_kind').notNull(),
  verdict: text('verdict').notNull(),
  checklistJson: text('checklist_json').notNull().default('{}'),
  note: text('note'),
  supersedesReviewId: text('supersedes_review_id'),
  createdAt: timestamps.createdAt,
}, (table) => [
  index('reviews_asset_idx').on(table.assetId),
  index('reviews_run_idx').on(table.runId),
]);

/** Delivery manifests make an exported cut reproducible and downloadable from R2. */
export const deliveries = sqliteTable('deliveries', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  title: text('title').notNull(),
  status: text('status').notNull().default('draft'),
  manifestJson: text('manifest_json').notNull(),
  outputAssetId: text('output_asset_id'),
  createdBy: text('created_by').notNull(),
  createdAt: timestamps.createdAt,
  updatedAt: timestamps.updatedAt,
}, (table) => [index('deliveries_project_idx').on(table.projectId)]);

export const auditEvents = sqliteTable('audit_events', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  action: text('action').notNull(),
  actorId: text('actor_id'),
  detailJson: text('detail_json').notNull(),
  createdAt: timestamps.createdAt,
}, (table) => [index('audit_events_entity_idx').on(table.projectId, table.entityType, table.entityId)]);
