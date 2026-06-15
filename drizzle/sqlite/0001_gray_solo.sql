CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`agent_endpoint` text,
	`agent_method` text DEFAULT 'POST' NOT NULL,
	`agent_type` text,
	`agent_headers` text,
	`default_model` text DEFAULT 'gpt-4o-mini' NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `projects_org_id_idx` ON `projects` (`org_id`);--> statement-breakpoint
CREATE TABLE `run_results` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`run_id` text NOT NULL,
	`test_case_id` text NOT NULL,
	`agent_response` text,
	`response_time_ms` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`error_message` text,
	`needs_human` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`test_case_id`) REFERENCES `test_cases`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `run_results_org_id_idx` ON `run_results` (`org_id`);--> statement-breakpoint
CREATE INDEX `run_results_run_id_idx` ON `run_results` (`run_id`);--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`project_id` text NOT NULL,
	`name` text,
	`status` text DEFAULT 'queued' NOT NULL,
	`total_cases` integer DEFAULT 0 NOT NULL,
	`pass_count` integer DEFAULT 0 NOT NULL,
	`fail_count` integer DEFAULT 0 NOT NULL,
	`partial_count` integer DEFAULT 0 NOT NULL,
	`unrated_count` integer DEFAULT 0 NOT NULL,
	`pass_rate` integer,
	`trigger_type` text DEFAULT 'manual' NOT NULL,
	`triggered_by` text,
	`model_used` text,
	`created_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `runs_org_id_idx` ON `runs` (`org_id`);--> statement-breakpoint
CREATE INDEX `runs_project_id_idx` ON `runs` (`project_id`);--> statement-breakpoint
CREATE TABLE `secrets` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`ref_type` text NOT NULL,
	`ref_id` text NOT NULL,
	`name` text NOT NULL,
	`ciphertext` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `secrets_org_id_ref_type_ref_id_name_uniq` ON `secrets` (`org_id`,`ref_type`,`ref_id`,`name`);--> statement-breakpoint
CREATE TABLE `test_cases` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`input` text NOT NULL,
	`expected_output` text,
	`category` text,
	`order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `test_cases_org_id_idx` ON `test_cases` (`org_id`);--> statement-breakpoint
CREATE INDEX `test_cases_project_id_idx` ON `test_cases` (`project_id`);