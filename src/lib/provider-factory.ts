// ============================================================================
// Provider factory (composition root). Builds a concrete Provider from a
// named config, reading API keys from env. Lives OUTSIDE src/lib/ai so it is
// allowed to read env (the eval-path guard forbids that inside src/lib/ai). All
// supported providers are OpenAI-compatible, so one OpenAIProvider with a
// different baseUrl/model covers them.
// ============================================================================

import { OpenAIProvider } from "./ai/providers/openai";
import type { Provider } from "./ai/provider";

export type ProviderName = "openai" | "deepseek" | "openrouter" | "ollama";

interface ProviderSpec {
  baseUrl: string;
  envKey?: string; // env var holding the API key (ollama needs none)
  defaultModel: string;
}

const SPECS: Record<ProviderName, ProviderSpec> = {
  openai: { baseUrl: "https://api.openai.com/v1", envKey: "OPENAI_API_KEY", defaultModel: "gpt-4o-mini" },
  deepseek: { baseUrl: "https://api.deepseek.com/v1", envKey: "DEEPSEEK_API_KEY", defaultModel: "deepseek-chat" },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1", envKey: "OPENROUTER_API_KEY", defaultModel: "openai/gpt-4o-mini" },
  ollama: { baseUrl: "http://localhost:11434/v1", defaultModel: "llama3.1" },
};

export function isProviderName(value: string): value is ProviderName {
  return value === "openai" || value === "deepseek" || value === "openrouter" || value === "ollama";
}

export function defaultModelFor(name: ProviderName): string {
  return SPECS[name].defaultModel;
}

export function baseUrlFor(name: ProviderName): string {
  return SPECS[name].baseUrl;
}

export interface ResolveProviderOptions {
  name: ProviderName;
  apiKey?: string; // explicit override (e.g. a per-project key); else read from env
  baseUrl?: string;
  env?: Record<string, string | undefined>;
}

export function resolveProvider(opts: ResolveProviderOptions): Provider {
  const env = opts.env ?? process.env;
  const spec = SPECS[opts.name];

  let apiKey = opts.apiKey;
  if (!apiKey && spec.envKey) apiKey = env[spec.envKey];
  if (!apiKey && spec.envKey) {
    throw new Error(`Missing ${spec.envKey} for provider "${opts.name}"`);
  }

  return new OpenAIProvider({
    apiKey: apiKey ?? "", // ollama ignores it
    baseUrl: opts.baseUrl ?? spec.baseUrl,
  });
}

/**
 * Build a Provider from a raw OpenAI-compatible endpoint — ANY base URL + API
 * key + model. This is the tenant-configurable path: a project points at its
 * own judge (DeepSeek, OpenAI, OpenRouter, Ollama, LiteLLM, a self-hosted
 * vLLM, anything that speaks /chat/completions). Empty key is allowed for
 * local/no-auth endpoints (Ollama, LiteLLM).
 */
export function providerFromConfig(opts: { baseUrl: string; apiKey?: string }): Provider {
  return new OpenAIProvider({ apiKey: opts.apiKey ?? "", baseUrl: opts.baseUrl });
}
