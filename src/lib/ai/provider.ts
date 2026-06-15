// ============================================================================
// Provider seam — the ONLY abstraction the eval path may use to call an LLM.
//
// Eval-path code (judges, generators, scorers) depends on `Provider`, never on
// fetch/env directly. Concrete providers live in ./providers/* (the one place
// allowed to touch the network). `FakeProvider` makes the eval path testable
// with zero network and deterministic responses.
// ============================================================================

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface CompletionResult {
  text: string;
  /** The model the provider actually resolved/used (for reproducibility). */
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  raw?: unknown;
}

export interface Provider {
  readonly name: string;
  complete(req: CompletionRequest, signal?: AbortSignal): Promise<CompletionResult>;
}

/**
 * Test double. Returns scripted responses in order; records every request so
 * tests can assert on prompt/model/params. A scripted entry may be a string or
 * a function of the request.
 */
export class FakeProvider implements Provider {
  readonly name = "fake";
  readonly calls: CompletionRequest[] = [];
  private scripted: Array<string | ((req: CompletionRequest) => string)>;

  constructor(scripted: Array<string | ((req: CompletionRequest) => string)> = []) {
    this.scripted = [...scripted];
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    this.calls.push(req);
    const next = this.scripted.shift();
    const text = typeof next === "function" ? next(req) : next ?? "";
    return { text, model: req.model, inputTokens: 0, outputTokens: 0 };
  }
}
