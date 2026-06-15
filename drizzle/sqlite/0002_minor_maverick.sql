CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`type` text NOT NULL,
	`payload` text,
	`status` text DEFAULT 'queued' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`run_after` integer NOT NULL,
	`locked_at` integer,
	`locked_by` text,
	`last_error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `jobs_status_idx` ON `jobs` (`status`);--> statement-breakpoint
CREATE INDEX `jobs_org_id_idx` ON `jobs` (`org_id`);