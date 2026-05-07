import { db } from "@/db";
import { runResults, runs, testCases, conversations, conversationMessages } from "@/db/schema";
import { eq, and } from "drizzle-orm";

interface MultiTurnConfig {
  projectId: string;
  runId: string;
  apiKey: string;
  agentConfig: any;
}

export async function executeMultiTurnRun(config: MultiTurnConfig) {
  const project = await db.select().from(require("@/db/schema").projects).where(eq(require("@/db/schema").projects.id, config.projectId));
  if (!project[0]) throw new Error("Project not found");

  // Get test cases that have conversation threads
  const convCases = await db.select().from(testCases)
    .where(and(eq(testCases.projectId, config.projectId), eq(testCases.conversationId, "multi-turn")));

  for (const tc of convCases) {
    const startTime = Date.now();
    try {
      // Get conversation messages
      let messages: { role: string; content: string }[] = [];
      if (tc.conversationId) {
        const msgs = await db.select().from(conversationMessages)
          .where(eq(conversationMessages.conversationId, tc.conversationId))
          .orderBy(conversationMessages.order);
        messages = msgs.map(m => ({ role: m.role, content: m.content }));
      }

      if (messages.length === 0) {
        messages = [{ role: "user", content: tc.input }];
      }

      // Call agent with full conversation
      const agentConfig = JSON.parse(project[0].agentHeaders || "{}");
      const response = await callAgent(project[0], messages, config.apiKey);
      const responseTime = Date.now() - startTime;

      await db.insert(runResults).values({
        runId: config.runId,
        testCaseId: tc.id,
        agentResponse: response,
        responseTime,
        status: "completed",
        conversationId: tc.conversationId,
      });
    } catch (e: any) {
      await db.insert(runResults).values({
        runId: config.runId,
        testCaseId: tc.id,
        status: "error",
        errorMessage: e.message,
        responseTime: Date.now() - startTime,
      });
    }
  }

  // Update run stats
  await updateRunStats(config.runId);
}

async function callAgent(project: any, messages: { role: string; content: string }[], apiKey: string): Promise<string> {
  const config = JSON.parse(project.agentHeaders || "{}");
  const type = config.type || "custom";

  const timeout = setTimeout(() => { throw new Error("Agent timeout (30s)"); }, 30000);

  try {
    if (type === "openai" || type === "openrouter") {
      const baseUrl = type === "openrouter" ? "https://openrouter.ai/api/v1" : "https://api.openai.com/v1";
      const headers: any = { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` };
      if (type === "openrouter") {
        headers["HTTP-Referer"] = "https://evaldesk.dev";
        headers["X-Title"] = "EvalDesk";
      }
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: config.bodyTemplate?.model || "gpt-4o-mini",
          messages,
          max_tokens: config.bodyTemplate?.max_tokens || 1000,
          temperature: config.bodyTemplate?.temperature ?? 0.7,
        }),
      });
      const data = await res.json();
      return data.choices?.[0]?.message?.content || "";
    }

    // Custom endpoint
    const res = await fetch(project.agentEndpoint, {
      method: project.agentMethod || "POST",
      headers: { "Content-Type": "application/json", ...JSON.parse(config.headers || "{}") },
      body: JSON.stringify({ messages, input: messages[messages.length - 1]?.content }),
    });
    const data = await res.json();
    return typeof data === "string" ? data : data.response || data.output || data.message || JSON.stringify(data);
  } finally {
    clearTimeout(timeout);
  }
}

async function updateRunStats(runId: string) {
  const results = await db.select().from(runResults).where(eq(runResults.runId, runId));
  const completed = results.filter(r => r.status === "completed");
  const passCount = completed.filter(r => r.humanRating === "pass" || r.judgeRating === "pass").length;
  const failCount = completed.filter(r => r.humanRating === "fail" || r.judgeRating === "fail").length;
  const partialCount = completed.filter(r => r.humanRating === "partial" || r.judgeRating === "partial").length;
  const unratedCount = completed.length - passCount - failCount - partialCount;
  const passRate = completed.length > 0 ? Math.round(((passCount + partialCount * 0.5) / completed.length) * 100) : 0;

  await db.update(runs).set({
    status: "completed",
    totalCases: results.length,
    passCount,
    failCount,
    partialCount,
    unratedCount,
    passRate,
    completedAt: new Date(),
  }).where(eq(runs.id, runId));
}
