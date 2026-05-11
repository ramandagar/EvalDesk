import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createId } from "@/lib/utils";

// Users / Auth
export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  emailVerified: integer("email_verified", { mode: "timestamp" }),
  image: text("image"),
  role: text("role").default("owner"), // owner, admin, reviewer, readonly
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
  // Integration fields
  slackWebhookUrl: text("slack_webhook_url"),
  slackChannel: text("slack_channel"),
  slackNotifyOn: text("slack_notify_on"), // JSON array
  defaultJudgeId: text("default_judge_id"),
  defaultModel: text("default_model").default("gpt-4o-mini"),
  costPer1kInput: real("cost_per_1k_input"),
  costPer1kOutput: real("cost_per_1k_output"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Test Cases
export const testCases = sqliteTable("test_cases", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  input: text("input").notNull(),
  expectedOutput: text("expected_output"),
  category: text("category"),
  tags: text("tags"), // JSON array
  order: integer("order").default(0),
  // Multi-turn support
  conversationId: text("conversation_id").references(() => conversations.id),
  // Test case intelligence
  difficulty: text("difficulty").default("medium"), // easy, medium, hard
  isAdversarial: integer("is_adversarial", { mode: "boolean" }).default(false),
  adversarialType: text("adversarial_type"), // jailbreak, prompt_injection, data_leak, bias_probe
  source: text("source"), // manual, ai_generated, production, marketplace, golden
  goldenSet: integer("golden_set", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Runs — one execution of all test cases against an agent
export const runs = sqliteTable("runs", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name"),
  status: text("status").notNull().default("running"), // running, completed, failed
  totalCases: integer("total_cases").notNull().default(0),
  passCount: integer("pass_count").notNull().default(0),
  failCount: integer("fail_count").notNull().default(0),
  partialCount: integer("partial_count").notNull().default(0),
  unratedCount: integer("unrated_count").notNull().default(0),
  passRate: integer("pass_rate"), // percentage 0-100
  triggerType: text("trigger_type").notNull().default("manual"), // manual, api, scheduled
  triggeredBy: text("triggered_by").references(() => users.id),
  // Scheduling & cost
  scheduledRunId: text("scheduled_run_id").references(() => scheduledRuns.id),
  modelUsed: text("model_used"),
  totalInputTokens: integer("total_input_tokens"),
  totalOutputTokens: integer("total_output_tokens"),
  totalCost: real("total_cost"),
  // Regression gating
  passThreshold: integer("pass_threshold"),
  isGated: integer("is_gated", { mode: "boolean" }).default(false),
  // Approval workflow
  approvedBy: text("approved_by").references(() => users.id),
  approvedAt: integer("approved_at", { mode: "timestamp" }),
  approvalStatus: text("approval_status"), // pending, approved, rejected
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  completedAt: integer("completed_at", { mode: "timestamp" }),
});

// Individual result for each test case within a run
export const runResults = sqliteTable("run_results", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  runId: text("run_id").notNull().references(() => runs.id, { onDelete: "cascade" }),
  testCaseId: text("test_case_id").notNull().references(() => testCases.id, { onDelete: "cascade" }),
  agentResponse: text("agent_response"),
  responseTime: integer("response_time"), // ms
  status: text("status").notNull().default("pending"), // pending, completed, error, timeout
  errorMessage: text("error_message"),
  // Human rating
  humanRating: text("human_rating"), // pass, fail, partial
  humanComment: text("human_comment"),
  ratedBy: text("rated_by").references(() => users.id),
  ratedAt: integer("rated_at", { mode: "timestamp" }),
  // LLM judge
  judgeRating: text("judge_rating"),
  judgeScore: integer("judge_score"), // 0-100
  judgeReasoning: text("judge_reasoning"),
  // Multi-turn & streaming
  conversationId: text("conversation_id").references(() => conversations.id),
  streamingChunks: text("streaming_chunks"), // JSON array of token timestamps
  toolCallsJson: text("tool_calls_json"), // JSON array of parsed tool calls
  // Cost tracking
  tokensInput: integer("tokens_input"),
  tokensOutput: integer("tokens_output"),
  cost: real("cost"),
  // Judge enhancements
  judgeCriteriaId: text("judge_criteria_id").references(() => judgeCriteria.id),
  consensusRating: text("consensus_rating"), // multi-judge majority vote
  consensusScore: integer("consensus_score"),
  safetyFlagged: integer("safety_flagged", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Custom Judge Criteria — user-defined scoring rubrics
export const judgeCriteria = sqliteTable("judge_criteria", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  criteria: text("criteria").notNull(),
  passThreshold: integer("pass_threshold").notNull().default(70),
  model: text("model").default("gpt-4o-mini"),
  isDefault: integer("is_default", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// A/B Tests — compare two prompts against the same test cases
export const abTests = sqliteTable("ab_tests", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  promptA: text("prompt_a").notNull(),
  promptB: text("prompt_b").notNull(),
  modelA: text("model_a").default("gpt-4o-mini"),
  modelB: text("model_b").default("gpt-4o-mini"),
  status: text("status").notNull().default("pending"),
  resultsA: text("results_a"),
  resultsB: text("results_b"),
  summary: text("summary"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  completedAt: integer("completed_at", { mode: "timestamp" }),
});

// Eval Certificates — shareable trust badges
export const certificates = sqliteTable("certificates", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  runId: text("run_id").references(() => runs.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  description: text("description"),
  passRate: integer("pass_rate"),
  totalCases: integer("total_cases"),
  passCount: integer("pass_count"),
  failCount: integer("fail_count"),
  isPublic: integer("is_public", { mode: "boolean" }).default(true),
  badgeColor: text("badge_color").default("#ABC83A"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
});

// ============================================================
// NEW TABLES — Stream 2: Multi-turn + Streaming + Tool Calls
// ============================================================

// Conversations — multi-turn test threads
export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Conversation messages — individual turns in a conversation
export const conversationMessages = sqliteTable("conversation_messages", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  conversationId: text("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // user, assistant, system, tool
  content: text("content").notNull(),
  toolCalls: text("tool_calls"), // JSON array of {name, arguments, result}
  order: integer("order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Tool calls log — parsed tool calls from agent responses
export const toolCallsLog = sqliteTable("tool_calls_log", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  runResultId: text("run_result_id").notNull().references(() => runResults.id, { onDelete: "cascade" }),
  toolName: text("tool_name").notNull(),
  arguments: text("arguments"), // JSON
  result: text("result"),
  expectedResult: text("expected_result"),
  isValid: integer("is_valid"), // boolean
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// ============================================================
// Stream 3: Judge System Enhancements
// ============================================================

// Multi-judge results — individual model votes for consensus
export const multiJudgeResults = sqliteTable("multi_judge_results", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  runResultId: text("run_result_id").notNull().references(() => runResults.id, { onDelete: "cascade" }),
  model: text("model").notNull(),
  rating: text("rating").notNull(), // pass, fail, partial
  score: integer("score").notNull(),
  reasoning: text("reasoning"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Judge templates — domain-specific scoring rubrics
export const judgeTemplates = sqliteTable("judge_templates", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  domain: text("domain").notNull(), // medical, legal, finance, education, general
  name: text("name").notNull(),
  description: text("description"),
  criteria: text("criteria").notNull(),
  passThreshold: integer("pass_threshold").notNull().default(70),
  isOfficial: integer("is_official", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Safety scores — toxicity, hallucination, bias detection
export const safetyScores = sqliteTable("safety_scores", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  runResultId: text("run_result_id").notNull().references(() => runResults.id, { onDelete: "cascade" }),
  toxicityScore: real("toxicity_score").notNull().default(0),
  hallucinationScore: real("hallucination_score").notNull().default(0),
  biasScore: real("bias_score").notNull().default(0),
  overallSafety: real("overall_safety").notNull().default(1.0),
  flaggedIssues: text("flagged_issues"), // JSON array
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Citation checks — verify agent citations
export const citationChecks = sqliteTable("citation_checks", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  runResultId: text("run_result_id").notNull().references(() => runResults.id, { onDelete: "cascade" }),
  citationText: text("citation_text").notNull(),
  sourceUrl: text("source_url"),
  isVerified: integer("is_verified"), // boolean
  verificationStatus: text("verification_status"), // verified, unverified, contradicted
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// ============================================================
// Stream 5: Integrations
// ============================================================

// Webhooks — external notifications on events
export const webhooks = sqliteTable("webhooks", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  events: text("events").notNull(), // JSON array: ["run.completed", "regression.detected"]
  secret: text("secret"),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  lastTriggered: integer("last_triggered", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Webhook deliveries — log of sent webhooks
export const webhookDeliveries = sqliteTable("webhook_deliveries", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  webhookId: text("webhook_id").notNull().references(() => webhooks.id, { onDelete: "cascade" }),
  event: text("event").notNull(),
  payload: text("payload"), // JSON
  statusCode: integer("status_code"),
  responseBody: text("response_body"),
  success: integer("success"), // boolean
  attempts: integer("attempts").default(1),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Scheduled runs — cron-style automatic evaluations
export const scheduledRuns = sqliteTable("scheduled_runs", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  cronExpression: text("cron_expression").notNull(),
  runNameTemplate: text("run_name_template"),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  lastRunAt: integer("last_run_at", { mode: "timestamp" }),
  nextRunAt: integer("next_run_at", { mode: "timestamp" }),
  createdBy: text("created_by").references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// ============================================================
// Stream 6: Collaboration & Access
// ============================================================

// Comments — threaded discussion on results
export const comments = sqliteTable("comments", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  runResultId: text("run_result_id").references(() => runResults.id, { onDelete: "cascade" }),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  parentId: text("parent_id"),
  userId: text("user_id").notNull().references(() => users.id),
  body: text("body").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Annotation queues — assign results to reviewers
export const annotationQueues = sqliteTable("annotation_queues", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  runResultId: text("run_result_id").notNull().references(() => runResults.id, { onDelete: "cascade" }),
  assignedTo: text("assigned_to").references(() => users.id),
  priority: text("priority").default("normal"), // low, normal, high, urgent
  status: text("status").default("pending"), // pending, in_progress, completed, skipped
  dueAt: integer("due_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// API keys — programmatic access
export const apiKeys = sqliteTable("api_keys", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull(),
  keyPrefix: text("key_prefix").notNull(), // first 8 chars for identification
  permissions: text("permissions").default('["read"]'), // JSON array
  lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// ============================================================
// Billing & Marketing
// ============================================================

export const plans = sqliteTable("plans", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  name: text("name").notNull(),
  price: real("price").notNull().default(0),
  interval: text("interval").default("month"),
  features: text("features"),
  limits: text("limits"),
  stripePriceId: text("stripe_price_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const subscriptions = sqliteTable("subscriptions", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  userId: text("user_id").notNull(),
  planId: text("plan_id").notNull(),
  status: text("status").notNull().default("active"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  currentPeriodStart: integer("current_period_start", { mode: "timestamp" }),
  currentPeriodEnd: integer("current_period_end", { mode: "timestamp" }),
  cancelAtPeriodEnd: integer("cancel_at_period_end", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const blogPosts = sqliteTable("blog_posts", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  content: text("content").notNull(),
  excerpt: text("excerpt"),
  author: text("author").notNull(),
  coverImage: text("cover_image"),
  publishedAt: integer("published_at", { mode: "timestamp" }),
  tags: text("tags"),
  isPublished: integer("is_published", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const invoices = sqliteTable("invoices", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  userId: text("user_id").notNull(),
  subscriptionId: text("subscription_id"),
  amount: real("amount").notNull(),
  currency: text("currency").default("usd"),
  status: text("status").notNull().default("draft"),
  stripeInvoiceId: text("stripe_invoice_id"),
  pdfUrl: text("pdf_url"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const onboardingState = sqliteTable("onboarding_state", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  userId: text("user_id").notNull(),
  currentStep: integer("current_step").notNull().default(1),
  completedSteps: text("completed_steps"),
  role: text("role"),
  useCase: text("use_case"),
  agentType: text("agent_type"),
  isComplete: integer("is_complete", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Audit log — track every action
export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  userId: text("user_id").references(() => users.id),
  projectId: text("project_id").references(() => projects.id),
  action: text("action").notNull(), // run.created, rating.submitted, project.deleted, etc.
  resourceType: text("resource_type"), // run, test_case, project, api_key, etc.
  resourceId: text("resource_id"),
  details: text("details"), // JSON
  ipAddress: text("ip_address"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});
