import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createId } from "@/lib/utils";

// Users / Auth
export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  emailVerified: integer("email_verified", { mode: "timestamp" }),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  sessionToken: text("session_token").notNull().unique(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp" }).notNull(),
});

export const verificationTokens = sqliteTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull().unique(),
  expires: integer("expires", { mode: "timestamp" }).notNull(),
});

// Projects
export const projects = sqliteTable("projects", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  name: text("name").notNull(),
  description: text("description"),
  agentEndpoint: text("agent_endpoint"),
  agentApiKey: text("agent_api_key"),
  agentMethod: text("agent_method").default("POST"),
  agentHeaders: text("agent_headers"), // JSON string of custom headers
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Test Cases
export const testCases = sqliteTable("test_cases", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  input: text("input").notNull(), // The question/prompt to send to the agent
  expectedOutput: text("expected_output"), // Optional: what a good answer looks like
  category: text("category"), // Optional grouping: "medical", "legal", etc.
  tags: text("tags"), // JSON array of tags
  order: integer("order").default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Runs — one execution of all test cases against an agent
export const runs = sqliteTable("runs", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name"), // Optional label like "v2.1 regression test"
  status: text("status").notNull().default("running"), // running, completed, failed
  totalCases: integer("total_cases").notNull().default(0),
  passCount: integer("pass_count").notNull().default(0),
  failCount: integer("fail_count").notNull().default(0),
  partialCount: integer("partial_count").notNull().default(0),
  unratedCount: integer("unrated_count").notNull().default(0),
  passRate: integer("pass_rate"), // percentage 0-100
  triggerType: text("trigger_type").notNull().default("manual"), // manual, api, scheduled
  triggeredBy: text("triggered_by").references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  completedAt: integer("completed_at", { mode: "timestamp" }),
});

// Individual result for each test case within a run
export const runResults = sqliteTable("run_results", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  runId: text("run_id").notNull().references(() => runs.id, { onDelete: "cascade" }),
  testCaseId: text("test_case_id").notNull().references(() => testCases.id, { onDelete: "cascade" }),
  agentResponse: text("agent_response"), // Raw agent output
  responseTime: integer("response_time"), // ms
  status: text("status").notNull().default("pending"), // pending, completed, error, timeout
  errorMessage: text("error_message"),
  // Human rating
  humanRating: text("human_rating"), // pass, fail, partial
  humanComment: text("human_comment"),
  ratedBy: text("rated_by").references(() => users.id),
  ratedAt: integer("rated_at", { mode: "timestamp" }),
  // LLM judge
  judgeRating: text("judge_rating"), // pass, fail, partial
  judgeScore: integer("judge_score"), // 0-100
  judgeReasoning: text("judge_reasoning"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Custom Judge Criteria — user-defined scoring rubrics
export const judgeCriteria = sqliteTable("judge_criteria", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // e.g. "Medical Safety Judge"
  description: text("description"), // What this judge checks
  criteria: text("criteria").notNull(), // The plain English scoring rules
  passThreshold: integer("pass_threshold").notNull().default(70), // Score >= this = pass
  model: text("model").default("gpt-4o-mini"), // Which model to use as judge
  isDefault: integer("is_default", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// A/B Tests — compare two prompts against the same test cases
export const abTests = sqliteTable("ab_tests", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // e.g. "v2 vs v3 system prompt"
  promptA: text("prompt_a").notNull(), // First prompt to test
  promptB: text("prompt_b").notNull(), // Second prompt to test
  modelA: text("model_a").default("gpt-4o-mini"),
  modelB: text("model_b").default("gpt-4o-mini"),
  status: text("status").notNull().default("pending"), // pending, running, completed, failed
  resultsA: text("results_a"), // JSON — array of { testCaseId, response, score }
  resultsB: text("results_b"), // JSON — array of { testCaseId, response, score }
  summary: text("summary"), // JSON — { scoreA, scoreB, winner, details }
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  completedAt: integer("completed_at", { mode: "timestamp" }),
});

// Eval Certificates — shareable trust badges
export const certificates = sqliteTable("certificates", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  runId: text("run_id").references(() => runs.id, { onDelete: "set null" }),
  name: text("name").notNull(), // e.g. "Medical Triage Bot — Safety Certified"
  description: text("description"),
  passRate: integer("pass_rate"), // At time of certification
  totalCases: integer("total_cases"),
  passCount: integer("pass_count"),
  failCount: integer("fail_count"),
  isPublic: integer("is_public", { mode: "boolean" }).default(true),
  badgeColor: text("badge_color").default("#ABC83A"), // Brand color
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
});
