CREATE TABLE `webhook_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`webhook_id` text NOT NULL,
	`event` text NOT NULL,
	`payload` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`response_status` integer,
	`last_error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`webhook_id`) REFERENCES `webhooks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `webhook_deliveries_org_id_idx` ON `webhook_deliveries` (`org_id`);--> statement-breakpoint
CREATE INDEX `webhook_deliveries_webhook_id_idx` ON `webhook_deliveries` (`webhook_id`);--> statement-breakpoint
CREATE TABLE `webhooks` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`project_id` text,
	`url` text NOT NULL,
	`secret_ciphertext` text NOT NULL,
	`events` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `webhooks_org_id_idx` ON `webhooks` (`org_id`);--> statement-breakpoint
CREATE INDEX `webhooks_project_id_idx` ON `webhooks` (`project_id`);