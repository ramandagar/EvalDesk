CREATE TABLE "rate_limits" (
	"id" text PRIMARY KEY NOT NULL,
	"bucket" text NOT NULL,
	"window_start" bigint NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "rate_limits_bucket_window_start_uniq" ON "rate_limits" USING btree ("bucket","window_start");--> statement-breakpoint
CREATE INDEX "rate_limits_window_start_idx" ON "rate_limits" USING btree ("window_start");