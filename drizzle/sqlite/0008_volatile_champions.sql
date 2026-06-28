CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`seq` integer NOT NULL,
	`actor_id` text,
	`action` text NOT NULL,
	`resource_type` text,
	`resource_id` text,
	`details` text,
	`prev_hash` text NOT NULL,
	`hash` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `audit_events_org_id_seq_uniq` ON `audit_events` (`org_id`,`seq`);--> statement-breakpoint
CREATE INDEX `audit_events_org_id_idx` ON `audit_events` (`org_id`);