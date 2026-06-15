// ============================================================================
// Agent runner — calls the user's agent endpoint with a test input and returns
// the response. Supports OpenAI/DeepSeek/OpenRouter/LangChain/custom shapes
// (the "framework" dropdown). The HTTP call is injected (fetchImpl) so:
//   - production passes the SSRF-guarded safeFetch (no internal IPs reachable)
//   - tests pass a fake fetch (no network)
// ============================================================================

export type AgentType = "openai" | "openrouter" | "langchain" | "deepseek" | "custom";

export interface AgentConfig {
  endpoint: string;
  type?: AgentType;
  apiKey?: string;
  model?: string;
  method?: string;
  headers?: Record<string, string>;
  bodyTemplate?: Record<string, unknown>;
}

export interface AgentCallResult {
  response: string | null;
  error?: string;
  timeMs: number;
}

export interface RunnerDeps {
  fetchImpl: typeof fetch;
  now: () => number;
}

function pickContent(data: unknown): string {
  if (typeof data === "string") return data;
  const d = data as Record<string, any>;
  const candidate =
    d?.choices?.[0]?.message?.content ??
    d?.output ??
    d?.result ??
    d?.return_value?.message ??
    d?.response ??
    d?.answer ??
    d?.message ??
    d?.content ??
    d?.text;
  if (typeof candidate === "string") return candidate;
  return candidate != null ? JSON.stringify(candidate) : JSON.stringify(data);
}

function buildRequest(input: string, config: AgentConfig): { headers: Record<string, string>; body: unknown; method: string } {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(config.headers ?? {}) };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;

  switch (config.type) {
    case "openai":
    case "deepseek":
      return {
        method: "POST",
        headers,
        body: {
          model: config.model ?? (config.type === "deepseek" ? "deepseek-chat" : "gpt-4o-mini"),
          messages: [{ role: "user", content: input }],
          temperature: 0,
          max_tokens: (config.bodyTemplate?.max_tokens as number) ?? 500,
        },
      };
    case "openrouter":
      return {
        method: "POST",
        headers: { ...headers, "HTTP-Referer": "https://evaldesk.dev", "X-Title": "EvalDesk" },
        body: {
          model: config.model ?? "openai/gpt-4o-mini",
          messages: [{ role: "user", content: input }],
        },
      };
    case "langchain":
      return { method: "POST", headers, body: { input: { message: input }, config: {} } };
    default:
      return {
        method: config.method ?? "POST",
        headers,
        body: config.bodyTemplate ? { ...config.bodyTemplate, message: input, input } : { message: input, input },
      };
  }
}

export async function callAgent(
  deps: RunnerDeps,
  input: string,
  config: AgentConfig,
): Promise<AgentCallResult> {
  const start = deps.now();
  try {
    const { headers, body, method } = buildRequest(input, config);
    const res = await deps.fetchImpl(config.endpoint, {
      method,
      headers,
      body: JSON.stringify(body),
    });
    const timeMs = deps.now() - start;

    if (!res.ok) {
      const detail = await res.text().catch(() => res.statusText);
      return { response: null, error: `HTTP ${res.status}: ${detail}`, timeMs };
    }

    const data = await res.json().catch(() => null);
    return { response: pickContent(data), timeMs };
  } catch (e) {
    return {
      response: null,
      error: e instanceof Error ? e.message : "Agent call failed",
      timeMs: deps.now() - start,
    };
  }
}
