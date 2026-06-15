CREATE TABLE "eval_certificates" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"run_id" text NOT NULL,
	"content_hash" text NOT NULL,
	"signature" text NOT NULL,
	"signing_key_id" text NOT NULL,
	"algo" text DEFAULT 'ed25519' NOT NULL,
	"public_key_pem" text NOT NULL,
	"canonical_json" text,
	"payload" jsonb,
	"weighting_scheme" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"signed_at" bigint NOT NULL,
	"expires_at" bigint
);
--> statement-breakpoint
CREATE TABLE "run_signoffs" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"run_id" text NOT NULL,
	"reviewer_id" text NOT NULL,
	"decision" text NOT NULL,
	"note" text,
	"credential_snapshot" jsonb,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signing_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text,
	"public_key_pem" text NOT NULL,
	"private_key_secret_id" text,
	"algo" text DEFAULT 'ed25519' NOT NULL,
	"created_at" bigint NOT NULL,
	"retired_at" bigint
);
--> statement-breakpoint
CREATE TABLE "signoff_policies" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"project_id" text NOT NULL,
	"min_reviewers" integer DEFAULT 1 NOT NULL,
	"required_role" text,
	"require_verified_credential" boolean DEFAULT false NOT NULL,
	"min_kappa" double precision,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" text,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "eval_certificates" ADD CONSTRAINT "eval_certificates_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_certificates" ADD CONSTRAINT "eval_certificates_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_signoffs" ADD CONSTRAINT "run_signoffs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_signoffs" ADD CONSTRAINT "run_signoffs_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signoff_policies" ADD CONSTRAINT "signoff_policies_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signoff_policies" ADD CONSTRAINT "signoff_policies_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "eval_certificates_run_id_uniq" ON "eval_certificates" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "eval_certificates_org_id_idx" ON "eval_certificates" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "run_signoffs_run_id_reviewer_id_uniq" ON "run_signoffs" USING btree ("run_id","reviewer_id");--> statement-breakpoint
CREATE INDEX "run_signoffs_org_id_idx" ON "run_signoffs" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "run_signoffs_run_id_idx" ON "run_signoffs" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "signing_keys_org_id_idx" ON "signing_keys" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "signoff_policies_org_id_idx" ON "signoff_policies" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "signoff_policies_project_id_idx" ON "signoff_policies" USING btree ("project_id");