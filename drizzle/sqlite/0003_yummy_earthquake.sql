CREATE TABLE `adjudications` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`run_result_id` text NOT NULL,
	`rubric_version_id` text,
	`final_label` text NOT NULL,
	`method` text NOT NULL,
	`weighting_scheme` text,
	`agreement_summary` text,
	`decided_by` text,
	`decided_at` integer NOT NULL,
	`locked` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_result_id`) REFERENCES `run_results`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `adjudications_run_result_id_uniq` ON `adjudications` (`run_result_id`);--> statement-breakpoint
CREATE INDEX `adjudications_org_id_idx` ON `adjudications` (`org_id`);--> statement-breakpoint
CREATE TABLE `agreement_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`scope_type` text NOT NULL,
	`scope_id` text NOT NULL,
	`rubric_version_id` text,
	`ai_human_agreement_pct` real,
	`ai_human_confusion` text,
	`kappa` real,
	`kappa_method` text,
	`weighting_scheme` text,
	`n_items` integer,
	`n_raters` integer,
	`ci_lo` real,
	`ci_hi` real,
	`window_start` integer,
	`window_end` integer,
	`computed_at` integer NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `agreement_metrics_org_id_idx` ON `agreement_metrics` (`org_id`);--> statement-breakpoint
CREATE INDEX `agreement_metrics_scope_type_scope_id_idx` ON `agreement_metrics` (`scope_type`,`scope_id`);--> statement-breakpoint
CREATE TABLE `ai_scores` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`run_result_id` text NOT NULL,
	`rubric_version_id` text,
	`judge_config_version_id` text,
	`provider` text,
	`model` text NOT NULL,
	`model_resolved` text,
	`prompt_hash` text,
	`label` text NOT NULL,
	`score_num` real,
	`confidence` real,
	`self_consistency` real,
	`disagreement` real,
	`rationale` text,
	`raw` text,
	`idempotency_key` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_result_id`) REFERENCES `run_results`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_scores_idempotency_key_uniq` ON `ai_scores` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `ai_scores_org_id_idx` ON `ai_scores` (`org_id`);--> statement-breakpoint
CREATE INDEX `ai_scores_run_result_id_idx` ON `ai_scores` (`run_result_id`);--> statement-breakpoint
CREATE TABLE `human_ratings` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`run_result_id` text NOT NULL,
	`rubric_version_id` text,
	`reviewer_id` text,
	`label` text NOT NULL,
	`score_num` real,
	`rationale` text,
	`confidence` real,
	`supersedes_id` text,
	`credential_snapshot` text,
	`signature` text,
	`signing_key_id` text,
	`attempt_id` text NOT NULL,
	`signed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_result_id`) REFERENCES `run_results`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `human_ratings_run_result_id_reviewer_id_attempt_id_uniq` ON `human_ratings` (`run_result_id`,`reviewer_id`,`attempt_id`);--> statement-breakpoint
CREATE INDEX `human_ratings_org_id_idx` ON `human_ratings` (`org_id`);--> statement-breakpoint
CREATE INDEX `human_ratings_run_result_id_idx` ON `human_ratings` (`run_result_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `human_ratings_run_result_id_reviewer_id_current_uniq` ON `human_ratings` (`run_result_id`,`reviewer_id`) WHERE "human_ratings"."supersedes_id" is null;--> statement-breakpoint
CREATE TABLE `judge_calibration` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`project_id` text NOT NULL,
	`judge_model` text NOT NULL,
	`judge_prompt_hash` text,
	`weighting_scheme` text,
	`window_start` integer,
	`window_end` integer,
	`sample_n` integer,
	`audit_sample_n` integer,
	`agreement_pct` real,
	`weighted_kappa` real,
	`confusion` text,
	`bias` text,
	`mean_abs_score_error` real,
	`tau` real,
	`published` integer DEFAULT false NOT NULL,
	`computed_at` integer NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `judge_calibration_org_id_idx` ON `judge_calibration` (`org_id`);--> statement-breakpoint
CREATE INDEX `judge_calibration_project_id_idx` ON `judge_calibration` (`project_id`);--> statement-breakpoint
CREATE TABLE `rubrics` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`kind` text DEFAULT 'ordinal' NOT NULL,
	`labels` text NOT NULL,
	`scale_min` integer,
	`scale_max` integer,
	`always_human` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rubrics_project_id_name_version_uniq` ON `rubrics` (`project_id`,`name`,`version`);--> statement-breakpoint
CREATE INDEX `rubrics_org_id_idx` ON `rubrics` (`org_id`);--> statement-breakpoint
CREATE INDEX `rubrics_project_id_idx` ON `rubrics` (`project_id`);