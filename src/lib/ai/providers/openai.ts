// ============================================================================
// OpenAI-compatible provider. This file (and its siblings in providers/) is the
// ONLY sanctioned place in the eval path allowed to call fetch(). The eval-path
// guard excludes this directory.
//
// `fetchImpl` is injectable so the provider itself is unit-testable without a
// real network call.
// ============================================================================

import type { Provider, CompletionRequest, CompletionResult } from "../provider";

export interface OpenAIProviderOptions {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export class OpenAIProvider implements Provider {
  readonly name = "openai";

  constructor(private readonly opts: OpenAIProviderOptions) {}

  async complete(req: CompletionRequest, signal?: AbortSignal): Promise<CompletionResult> {
    const doFetch = this.opts.fetchImpl ?? fetch;
    const baseUrl = this.opts.baseUrl ?? "https://api.openai.com/v1";

    const res = await doFetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.opts.apiKey}`,
      },
      body: JSON.stringify({
        model: req.model,
        messages: req.messages,
        temperature: req.temperature ?? 0,
        max_tokens: req.maxTokens ?? 500,
        ...(req.jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
      signal,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => res.statusText);
      throw new Error(`OpenAI HTTP ${res.status}: ${detail}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    return {
      text: data.choices?.[0]?.message?.content ?? "",
      model: data.model ?? req.model,
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
      raw: data,
    };
  }
}
