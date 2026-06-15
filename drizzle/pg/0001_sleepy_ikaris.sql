CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"agent_endpoint" text,
	"agent_method" text DEFAULT 'POST' NOT NULL,
	"agent_type" text,
	"agent_headers" jsonb,
	"default_model" text DEFAULT 'gpt-4o-mini' NOT NULL,
	"created_by" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run_results" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"run_id" text NOT NULL,
	"test_case_id" text NOT NULL,
	"agent_response" text,
	"response_time_ms" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"needs_human" boolean DEFAULT false NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"project_id" text NOT NULL,
	"name" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"total_cases" integer DEFAULT 0 NOT NULL,
	"pass_count" integer DEFAULT 0 NOT NULL,
	"fail_count" integer DEFAULT 0 NOT NULL,
	"partial_count" integer DEFAULT 0 NOT NULL,
	"unrated_count" integer DEFAULT 0 NOT NULL,
	"pass_rate" integer,
	"trigger_type" text DEFAULT 'manual' NOT NULL,
	"triggered_by" text,
	"model_used" text,
	"created_at" bigint NOT NULL,
	"completed_at" bigint
);
--> statement-breakpoint
CREATE TABLE "secrets" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"ref_type" text NOT NULL,
	"ref_id" text NOT NULL,
	"name" text NOT NULL,
	"ciphertext" text NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "test_cases" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"project_id" text NOT NULL,
	"title" text NOT NULL,
	"input" text NOT NULL,
	"expected_output" text,
	"category" text,
	"order" integer DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_results" ADD CONSTRAINT "run_results_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_results" ADD CONSTRAINT "run_results_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_results" ADD CONSTRAINT "run_results_test_case_id_test_cases_id_fk" FOREIGN KEY ("test_case_id") REFERENCES "public"."test_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secrets" ADD CONSTRAINT "secrets_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "projects_org_id_idx" ON "projects" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "run_results_org_id_idx" ON "run_results" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "run_results_run_id_idx" ON "run_results" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "runs_org_id_idx" ON "runs" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "runs_project_id_idx" ON "runs" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "secrets_org_id_ref_type_ref_id_name_uniq" ON "secrets" USING btree ("org_id","ref_type","ref_id","name");--> statement-breakpoint
CREATE INDEX "test_cases_org_id_idx" ON "test_cases" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "test_cases_project_id_idx" ON "test_cases" USING btree ("project_id");