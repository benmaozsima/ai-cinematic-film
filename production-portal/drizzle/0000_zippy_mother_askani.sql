CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`shot_id` text,
	`type` text NOT NULL,
	`version` text NOT NULL,
	`status` text NOT NULL,
	`storage_key` text,
	`sha256` text,
	`lineage_json` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`actor_id` text,
	`detail_json` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`quote_id` text NOT NULL,
	`status` text NOT NULL,
	`provider_request_id` text,
	`actual_cost_usd` text,
	`result_asset_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`canonical_version` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`payload_hash` text NOT NULL,
	`payload_json` text NOT NULL,
	`max_cost_usd` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
