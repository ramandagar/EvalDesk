import { db } from "@/db";
import { runs, runResults, testCases } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createId } from "./utils";

// ============ AGENT ADAPTERS ============
// Each adapter knows how to call a specific type of AI agent API

type AgentConfig = {
  endpoint?: string;
  apiKey?: string;
  method?: string;
  headers?: Record<string, string>;
  type?: string; // "openai" | "openrouter" | "langchain" | "deepseek" | "custom"
  model?: string;
  bodyTemplate?: Record<string, any>;
};

function parseAgentConfig(rawHeaders?: string | null): AgentConfig {
  if (!rawHeaders) return { endpoint: "", type: "custom" };
  try {
    const parsed = JSON.parse(rawHeaders);
    return {
      type: parsed.type || "custom",
      model: parsed.model || undefined,
      bodyTemplate: parsed.bodyTemplate,
      headers: parsed.headers,
    };
  } catch { return { endpoint: "", type: "custom" }; }
}

async function callOpenAI(input: string, config: AgentConfig): Promise<{ response: string | null; error?: string; time: number }> {
  const start = Date.now();
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (config.apiKey) headers["Authorization"] = `Bearer ${config.apiKey}`;

    const res = await fetch(config.endpoint || "", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: config.model || config.bodyTemplate?.model || "gpt-4o-mini",
        messages: [{ role: "user", content: input }],
        max_tokens: config.bodyTemplate?.max_tokens || 500,
        temperature: config.bodyTemplate?.temperature ?? 0,
      }),
    });

    const time = Date.now() - start;
    if (!res.ok) return { response: null, error: `HTTP ${res.status}: ${await res.text().catch(() => res.statusText)}`, time };

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || data.response || data.output || JSON.stringify(data);
    return { response: typeof content === "string" ? content : JSON.stringify(content), time };
  } catch (e: any) {
    return { response: null, error: e.message, time: Date.now() - start };
  }
}

async function callOpenRouter(input: string, config: AgentConfig): Promise<{ response: string | null; error?: string; time: number }> {
  const start = Date.now();
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "HTTP-Referer": "https://evaldesk.dev",
      "X-Title": "EvalDesk",
    };
    if (config.apiKey) headers["Authorization"] = `Bearer ${config.apiKey}`;

    const res = await fetch(config.endpoint || "", {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: config.model || config.bodyTemplate?.model || "openai/gpt-4o-mini",
        messages: [{ role: "user", content: input }],
      }),
    });

    const time = Date.now() - start;
    if (!res.ok) return { response: null, error: `HTTP ${res.status}: ${await res.text().catch(() => res.statusText)}`, time };

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || data.response || JSON.stringify(data);
    return { response: typeof content === "string" ? content : JSON.stringify(content), time };
  } catch (e: any) {
    return { response: null, error: e.message, time: Date.now() - start };
  }
}

async function callLangChain(input: string, config: AgentConfig): Promise<{ response: string | null; error?: string; time: number }> {
  const start = Date.now();
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (config.apiKey) headers["Authorization"] = `Bearer ${config.apiKey}`;

    // LangChain serve /invoke format
    const res = await fetch(config.endpoint || "", {
      method: "POST",
      headers,
      body: JSON.stringify({ input: { message: input }, config: {} }),
    });

    const time = Date.now() - start;
    if (!res.ok) return { response: null, error: `HTTP ${res.status}: ${await res.text().catch(() => res.statusText)}`, time };

    const data = await res.json();
    // LangChain outputs: output, result, return_value, or direct
    const content = data.output || data.result || data.return_value?.message || data.content || data.response || data.answer || JSON.stringify(data);
    return { response: typeof content === "string" ? content : JSON.stringify(content), time };
  } catch (e: any) {
    return { response: null, error: e.message, time: Date.now() - start };
  }
}

async function callCustom(input: string, config: AgentConfig): Promise<{ response: string | null; error?: string; time: number }> {
  const start = Date.now();
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json", ...(config.headers || {}) };
    if (config.apiKey) headers["Authorization"] = `Bearer ${config.apiKey}`;

    // Generic: try common body formats
    const body = config.bodyTemplate
      ? { ...config.bodyTemplate, message: input, input }
      : { message: input, input };

    const res = await fetch(config.endpoint || "", {
      method: config.method || "POST",
      headers,
      body: JSON.stringify(body),
    });

    const time = Date.now() - start;
    if (!res.ok) return { response: null, error: `HTTP ${res.status}: ${await res.text().catch(() => res.statusText)}`, time };

    const data = await res.json();
    const content = data.response || data.output || data.message || data.answer || data.content || data.result || data.text || JSON.stringify(data);
    return { response: typeof content === "string" ? content : JSON.stringify(content), time };
  } catch (e: any) {
    return { response: null, error: e.message, time: Date.now() - start };
  }
}

async function callDeepSeek(input: string, config: AgentConfig): Promise<{ response: string | null; error?: string; time: number }> {
  const start = Date.now();
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (config.apiKey) headers["Authorization"] = `Bearer ${config.apiKey}`;

    const endpoint = config.endpoint || "https://api.deepseek.com/v1/chat/completions";

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: config.model || "deepseek-chat",
        messages: [{ role: "user", content: input }],
        max_tokens: config.bodyTemplate?.max_tokens || 500,
        temperature: config.bodyTemplate?.temperature ?? 0,
      }),
    });

    const time = Date.now() - start;
    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      return { response: null, error: `DeepSeek HTTP ${res.status}: ${errText}`, time };
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || data.response || JSON.stringify(data);
    return { response: typeof content === "string" ? content : JSON.stringify(content), time };
  } catch (e: any) {
    return { response: null, error: e.message, time: Date.now() - start };
  }
}

// ============ ROUTER ============

async function callAgent(input: string, config: AgentConfig): Promise<{ response: string | null; error?: string; time: number }> {
  switch (config.type) {
    case "openai": return callOpenAI(input, config);
    case "openrouter": return callOpenRouter(input, config);
    case "langchain": return callLangChain(input, config);
    case "deepseek": return callDeepSeek(input, config);
    default: return callCustom(input, config);
  }
}

// ============ RUN EXECUTOR ============

export async function executeRun(config: {
  projectId: string;
  endpoint: string;
  apiKey?: string;
  method?: string;
  headers?: string | null;
  runName?: string;
  triggeredBy?: string;
  timeout?: number;
}) {
  const runId = createId();
  const timeout = config.timeout || 30000;

  const cases = await db.select().from(testCases).where(eq(testCases.projectId, config.projectId));
  if (cases.length === 0) throw new Error("No test cases found. Add test cases first.");

  const agentConfig = parseAgentConfig(config.headers);
  agentConfig.endpoint = config.endpoint;
  agentConfig.apiKey = config.apiKey;
  agentConfig.method = config.method;

  await db.insert(runs).values({
    id: runId,
    projectId: config.projectId,
    name: config.runName || `Run ${new Date().toLocaleString()}`,
    status: "running",
    totalCases: cases.length,
    unratedCount: cases.length,
    triggerType: "manual",
    triggeredBy: config.triggeredBy,
  });

  let completedCount = 0;
  for (const tc of cases) {
    const result = await callAgent(tc.input, agentConfig);
    completedCount++;

    await db.insert(runResults).values({
      id: createId(),
      runId,
      testCaseId: tc.id,
      agentResponse: result.response,
      responseTime: result.time,
      status: result.error ? "error" : "completed",
      errorMessage: result.error,
    });
  }

  await db.update(runs).set({ status: "completed", completedAt: new Date(), unratedCount: cases.length }).where(eq(runs.id, runId));

  return { runId, totalCases: cases.length };
}

export async function updateRunStats(runId: string) {
  const results = await db.select().from(runResults).where(eq(runResults.runId, runId));
  const passCount = results.filter(r => r.humanRating === "pass").length;
  const failCount = results.filter(r => r.humanRating === "fail").length;
  const partialCount = results.filter(r => r.humanRating === "partial").length;
  const unratedCount = results.filter(r => !r.humanRating).length;
  const rated = passCount + failCount + partialCount;
  const passRate = rated > 0 ? Math.round((passCount / rated) * 100) : null;

  await db.update(runs).set({ passCount, failCount, partialCount, unratedCount, passRate }).where(eq(runs.id, runId));
}
