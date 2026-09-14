ALTER TABLE `projects` ADD `status` text NOT NULL DEFAULT 'active';
--> statement-breakpoint
ALTER TABLE `projects` ADD `settings_json` text NOT NULL DEFAULT '{}';
--> statement-breakpoint
ALTER TABLE `projects` ADD `updated_at` integer;
--> statement-breakpoint
ALTER TABLE `assets` ADD `canonical_asset_id` text;
--> statement-breakpoint
ALTER TABLE `assets` ADD `media_url` text;
--> statement-breakpoint
ALTER TABLE `assets` ADD `mime_type` text;
--> statement-breakpoint
ALTER TABLE `assets` ADD `byte_size` integer;
--> statement-breakpoint
ALTER TABLE `assets` ADD `width` integer;
--> statement-breakpoint
ALTER TABLE `assets` ADD `height` integer;
--> statement-breakpoint
ALTER TABLE `assets` ADD `duration_ms` integer;
--> statement-breakpoint
ALTER TABLE `assets` ADD `prompt_snapshot_json` text;
--> statement-breakpoint
ALTER TABLE `assets` ADD `updated_at` integer;
--> statement-breakpoint
ALTER TABLE `quotes` ADD `provider` text NOT NULL DEFAULT 'unconfigured';
--> statement-breakpoint
ALTER TABLE `quotes` ADD `model` text NOT NULL DEFAULT 'unconfigured';
--> statement-breakpoint
ALTER TABLE `quotes` ADD `currency` text NOT NULL DEFAULT 'USD';
--> statement-breakpoint
ALTER TABLE `jobs` ADD `run_id` text;
--> statement-breakpoint
ALTER TABLE `jobs` ADD `retry_count` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `jobs` ADD `last_error_code` text;
--> statement-breakpoint
ALTER TABLE `jobs` ADD `last_error_safe_message` text;
--> statement-breakpoint
CREATE TABLE `canonical_assets` (
  `id` text PRIMARY KEY NOT NULL, `project_id` text NOT NULL, `kind` text NOT NULL,
  `canonical_label` text NOT NULL, `internal_label` text, `status` text NOT NULL DEFAULT 'draft',
  `constraints_json` text NOT NULL DEFAULT '{}', `current_revision_id` text,
  `created_at` integer NOT NULL, `updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `canonical_assets_project_label_unique` ON `canonical_assets` (`project_id`,`canonical_label`);
--> statement-breakpoint
CREATE INDEX `canonical_assets_project_kind_idx` ON `canonical_assets` (`project_id`,`kind`);
--> statement-breakpoint
CREATE INDEX `assets_project_shot_idx` ON `assets` (`project_id`,`shot_id`);
--> statement-breakpoint
CREATE INDEX `assets_canonical_asset_idx` ON `assets` (`canonical_asset_id`);
--> statement-breakpoint
CREATE TABLE `shots` (
  `id` text PRIMARY KEY NOT NULL, `project_id` text NOT NULL, `sequence_no` integer NOT NULL,
  `title` text NOT NULL, `duration_ms` integer NOT NULL, `status` text NOT NULL DEFAULT 'planned',
  `brief_json` text NOT NULL DEFAULT '{}', `continuity_json` text NOT NULL DEFAULT '{}',
  `created_at` integer NOT NULL, `updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shots_project_sequence_unique` ON `shots` (`project_id`,`sequence_no`);
--> statement-breakpoint
CREATE TABLE `shot_selections` (
  `id` text PRIMARY KEY NOT NULL, `project_id` text NOT NULL, `shot_id` text NOT NULL,
  `canonical_asset_id` text NOT NULL, `asset_revision_id` text, `role` text NOT NULL,
  `locked` integer NOT NULL DEFAULT false, `notes` text, `created_at` integer NOT NULL, `updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shot_selections_unique_role` ON `shot_selections` (`shot_id`,`canonical_asset_id`,`role`);
--> statement-breakpoint
CREATE INDEX `shot_selections_shot_idx` ON `shot_selections` (`shot_id`);
--> statement-breakpoint
CREATE TABLE `paid_approvals` (
  `id` text PRIMARY KEY NOT NULL, `project_id` text NOT NULL, `quote_id` text NOT NULL,
  `quote_payload_hash` text NOT NULL, `approval_snapshot_json` text NOT NULL,
  `actor_id` text NOT NULL, `idempotency_key` text NOT NULL, `approved_at` integer NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `paid_approvals_idempotency_unique` ON `paid_approvals` (`project_id`,`idempotency_key`);
--> statement-breakpoint
CREATE INDEX `paid_approvals_quote_idx` ON `paid_approvals` (`quote_id`);
--> statement-breakpoint
CREATE TABLE `generation_runs` (
  `id` text PRIMARY KEY NOT NULL, `project_id` text NOT NULL, `shot_id` text, `approval_id` text,
  `provider` text NOT NULL, `model` text NOT NULL, `request_hash` text NOT NULL,
  `request_snapshot_json` text NOT NULL, `reference_snapshot_json` text NOT NULL DEFAULT '[]',
  `status` text NOT NULL DEFAULT 'queued', `provider_request_id` text, `provider_response_json` text,
  `started_at` integer, `completed_at` integer, `created_at` integer NOT NULL, `updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `generation_runs_request_unique` ON `generation_runs` (`project_id`,`request_hash`);
--> statement-breakpoint
CREATE INDEX `generation_runs_shot_idx` ON `generation_runs` (`shot_id`);
--> statement-breakpoint
CREATE INDEX `generation_runs_approval_idx` ON `generation_runs` (`approval_id`);
--> statement-breakpoint
CREATE TABLE `reviews` (
  `id` text PRIMARY KEY NOT NULL, `project_id` text NOT NULL, `asset_id` text NOT NULL, `run_id` text,
  `reviewer_id` text NOT NULL, `reviewer_kind` text NOT NULL, `verdict` text NOT NULL,
  `checklist_json` text NOT NULL DEFAULT '{}', `note` text, `supersedes_review_id` text,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `reviews_asset_idx` ON `reviews` (`asset_id`);
--> statement-breakpoint
CREATE INDEX `reviews_run_idx` ON `reviews` (`run_id`);
--> statement-breakpoint
CREATE TABLE `deliveries` (
  `id` text PRIMARY KEY NOT NULL, `project_id` text NOT NULL, `title` text NOT NULL,
  `status` text NOT NULL DEFAULT 'draft', `manifest_json` text NOT NULL, `output_asset_id` text,
  `created_by` text NOT NULL, `created_at` integer NOT NULL, `updated_at` integer
);
--> statement-breakpoint
CREATE INDEX `deliveries_project_idx` ON `deliveries` (`project_id`);
--> statement-breakpoint
CREATE INDEX `audit_events_entity_idx` ON `audit_events` (`project_id`,`entity_type`,`entity_id`);
