import { describe, it, expect } from "vitest";
import { OpenAIProvider } from "@/lib/ai/providers/openai";

// The provider takes an injectable fetchImpl precisely so its request-shaping
// and response-parsing are testable without a real network call.
function captureFetch(response: Response) {
  const captured: { url?: string; init?: RequestInit } = {};
  const fn = (async (url: string, init: RequestInit) => {
    captured.url = url;
    captured.init = init;
    return response;
  }) as unknown as typeof fetch;
  return { fn, captured };
}

describe("OpenAIProvider", () => {
  it("shapes the request and parses a successful completion", async () => {
    const res = new Response(
      JSON.stringify({
        choices: [{ message: { content: "hello world" } }],
        model: "gpt-4o-mini-2024-07-18",
        usage: { prompt_tokens: 11, completion_tokens: 3 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
    const { fn, captured } = captureFetch(res);
    const provider = new OpenAIProvider({ apiKey: "sk-test", fetchImpl: fn });

    const out = await provider.complete({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "hi" }],
      jsonMode: true,
    });

    expect(out.text).toBe("hello world");
    expect(out.model).toBe("gpt-4o-mini-2024-07-18"); // resolved model echoed back
    expect(out.inputTokens).toBe(11);
    expect(out.outputTokens).toBe(3);

    expect(captured.url).toContain("/chat/completions");
    expect((captured.init!.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
    const body = JSON.parse(captured.init!.body as string);
    expect(body.model).toBe("gpt-4o-mini");
    expect(body.temperature).toBe(0);
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("omits response_format and defaults max_tokens when jsonMode is off", async () => {
    const res = new Response(JSON.stringify({ choices: [{ message: { content: "x" } }] }), {
      status: 200,
    });
    const { fn, captured } = captureFetch(res);
    const provider = new OpenAIProvider({ apiKey: "sk", fetchImpl: fn });

    await provider.complete({ model: "m", messages: [] });
    const body = JSON.parse(captured.init!.body as string);
    expect(body.max_tokens).toBe(500);
    expect(body.response_format).toBeUndefined();
  });

  it("throws with status + detail on a non-2xx response", async () => {
    const res = new Response("rate limited", { status: 429 });
    const provider = new OpenAIProvider({ apiKey: "sk", fetchImpl: (async () => res) as unknown as typeof fetch });
    await expect(provider.complete({ model: "m", messages: [] })).rejects.toThrow(/429.*rate limited/);
  });

  it("honors a custom baseUrl (Ollama / OpenRouter compatible)", async () => {
    const res = new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
      status: 200,
    });
    const { fn, captured } = captureFetch(res);
    const provider = new OpenAIProvider({ apiKey: "x", baseUrl: "http://localhost:11434/v1", fetchImpl: fn });
    await provider.complete({ model: "llama3", messages: [] });
    expect(captured.url).toBe("http://localhost:11434/v1/chat/completions");
  });
});
