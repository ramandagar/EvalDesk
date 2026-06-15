CREATE TABLE `eval_certificates` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`run_id` text NOT NULL,
	`content_hash` text NOT NULL,
	`signature` text NOT NULL,
	`signing_key_id` text NOT NULL,
	`algo` text DEFAULT 'ed25519' NOT NULL,
	`public_key_pem` text NOT NULL,
	`canonical_json` text,
	`payload` text,
	`weighting_scheme` text,
	`is_public` integer DEFAULT false NOT NULL,
	`signed_at` integer NOT NULL,
	`expires_at` integer,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `eval_certificates_run_id_uniq` ON `eval_certificates` (`run_id`);--> statement-breakpoint
CREATE INDEX `eval_certificates_org_id_idx` ON `eval_certificates` (`org_id`);--> statement-breakpoint
CREATE TABLE `run_signoffs` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`run_id` text NOT NULL,
	`reviewer_id` text NOT NULL,
	`decision` text NOT NULL,
	`note` text,
	`credential_snapshot` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `run_signoffs_run_id_reviewer_id_uniq` ON `run_signoffs` (`run_id`,`reviewer_id`);--> statement-breakpoint
CREATE INDEX `run_signoffs_org_id_idx` ON `run_signoffs` (`org_id`);--> statement-breakpoint
CREATE INDEX `run_signoffs_run_id_idx` ON `run_signoffs` (`run_id`);--> statement-breakpoint
CREATE TABLE `signing_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text,
	`public_key_pem` text NOT NULL,
	`private_key_secret_id` text,
	`algo` text DEFAULT 'ed25519' NOT NULL,
	`created_at` integer NOT NULL,
	`retired_at` integer
);
--> statement-breakpoint
CREATE INDEX `signing_keys_org_id_idx` ON `signing_keys` (`org_id`);--> statement-breakpoint
CREATE TABLE `signoff_policies` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`project_id` text NOT NULL,
	`min_reviewers` integer DEFAULT 1 NOT NULL,
	`required_role` text,
	`require_verified_credential` integer DEFAULT false NOT NULL,
	`min_kappa` real,
	`is_active` integer DEFAULT true NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `signoff_policies_org_id_idx` ON `signoff_policies` (`org_id`);--> statement-breakpoint
CREATE INDEX `signoff_policies_project_id_idx` ON `signoff_policies` (`project_id`);