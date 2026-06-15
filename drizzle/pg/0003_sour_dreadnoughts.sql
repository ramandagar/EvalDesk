CREATE TABLE "adjudications" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"run_result_id" text NOT NULL,
	"rubric_version_id" text,
	"final_label" text NOT NULL,
	"method" text NOT NULL,
	"weighting_scheme" text,
	"agreement_summary" jsonb,
	"decided_by" text,
	"decided_at" bigint NOT NULL,
	"locked" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agreement_metrics" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"scope_type" text NOT NULL,
	"scope_id" text NOT NULL,
	"rubric_version_id" text,
	"ai_human_agreement_pct" double precision,
	"ai_human_confusion" jsonb,
	"kappa" double precision,
	"kappa_method" text,
	"weighting_scheme" text,
	"n_items" integer,
	"n_raters" integer,
	"ci_lo" double precision,
	"ci_hi" double precision,
	"window_start" bigint,
	"window_end" bigint,
	"computed_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_scores" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"run_result_id" text NOT NULL,
	"rubric_version_id" text,
	"judge_config_version_id" text,
	"provider" text,
	"model" text NOT NULL,
	"model_resolved" text,
	"prompt_hash" text,
	"label" text NOT NULL,
	"score_num" double precision,
	"confidence" double precision,
	"self_consistency" double precision,
	"disagreement" double precision,
	"rationale" text,
	"raw" jsonb,
	"idempotency_key" text NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "human_ratings" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"run_result_id" text NOT NULL,
	"rubric_version_id" text,
	"reviewer_id" text,
	"label" text NOT NULL,
	"score_num" double precision,
	"rationale" text,
	"confidence" double precision,
	"supersedes_id" text,
	"credential_snapshot" jsonb,
	"signature" text,
	"signing_key_id" text,
	"attempt_id" text NOT NULL,
	"signed_at" bigint,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "judge_calibration" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"project_id" text NOT NULL,
	"judge_model" text NOT NULL,
	"judge_prompt_hash" text,
	"weighting_scheme" text,
	"window_start" bigint,
	"window_end" bigint,
	"sample_n" integer,
	"audit_sample_n" integer,
	"agreement_pct" double precision,
	"weighted_kappa" double precision,
	"confusion" jsonb,
	"bias" jsonb,
	"mean_abs_score_error" double precision,
	"tau" double precision,
	"published" boolean DEFAULT false NOT NULL,
	"computed_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rubrics" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"kind" text DEFAULT 'ordinal' NOT NULL,
	"labels" jsonb NOT NULL,
	"scale_min" integer,
	"scale_max" integer,
	"always_human" boolean DEFAULT false NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "adjudications" ADD CONSTRAINT "adjudications_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adjudications" ADD CONSTRAINT "adjudications_run_result_id_run_results_id_fk" FOREIGN KEY ("run_result_id") REFERENCES "public"."run_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreement_metrics" ADD CONSTRAINT "agreement_metrics_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_scores" ADD CONSTRAINT "ai_scores_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_scores" ADD CONSTRAINT "ai_scores_run_result_id_run_results_id_fk" FOREIGN KEY ("run_result_id") REFERENCES "public"."run_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "human_ratings" ADD CONSTRAINT "human_ratings_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "human_ratings" ADD CONSTRAINT "human_ratings_run_result_id_run_results_id_fk" FOREIGN KEY ("run_result_id") REFERENCES "public"."run_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judge_calibration" ADD CONSTRAINT "judge_calibration_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "judge_calibration" ADD CONSTRAINT "judge_calibration_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rubrics" ADD CONSTRAINT "rubrics_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rubrics" ADD CONSTRAINT "rubrics_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "adjudications_run_result_id_uniq" ON "adjudications" USING btree ("run_result_id");--> statement-breakpoint
CREATE INDEX "adjudications_org_id_idx" ON "adjudications" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "agreement_metrics_org_id_idx" ON "agreement_metrics" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "agreement_metrics_scope_type_scope_id_idx" ON "agreement_metrics" USING btree ("scope_type","scope_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_scores_idempotency_key_uniq" ON "ai_scores" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "ai_scores_org_id_idx" ON "ai_scores" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "ai_scores_run_result_id_idx" ON "ai_scores" USING btree ("run_result_id");--> statement-breakpoint
CREATE UNIQUE INDEX "human_ratings_run_result_id_reviewer_id_attempt_id_uniq" ON "human_ratings" USING btree ("run_result_id","reviewer_id","attempt_id");--> statement-breakpoint
CREATE INDEX "human_ratings_org_id_idx" ON "human_ratings" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "human_ratings_run_result_id_idx" ON "human_ratings" USING btree ("run_result_id");--> statement-breakpoint
CREATE UNIQUE INDEX "human_ratings_run_result_id_reviewer_id_current_uniq" ON "human_ratings" USING btree ("run_result_id","reviewer_id") WHERE "human_ratings"."supersedes_id" is null;--> statement-breakpoint
CREATE INDEX "judge_calibration_org_id_idx" ON "judge_calibration" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "judge_calibration_project_id_idx" ON "judge_calibration" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rubrics_project_id_name_version_uniq" ON "rubrics" USING btree ("project_id","name","version");--> statement-breakpoint
CREATE INDEX "rubrics_org_id_idx" ON "rubrics" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "rubrics_project_id_idx" ON "rubrics" USING btree ("project_id");