import { describe, it, expect } from "vitest";
import { callAgent, type RunnerDeps, type AgentConfig } from "@/lib/runner/agent-runner";

function fakeFetch(response: Response, captured?: { url?: string; init?: RequestInit }): typeof fetch {
  return (async (url: string, init: RequestInit) => {
    if (captured) {
      captured.url = url;
      captured.init = init;
    }
    return response;
  }) as unknown as typeof fetch;
}

const clock = (): RunnerDeps["now"] => {
  let t = 0;
  return () => (t += 5); // each call advances 5ms → timeMs = 5
};

describe("agent runner", () => {
  it("calls an OpenAI-shaped agent and parses the content", async () => {
    const captured: { url?: string; init?: RequestInit } = {};
    const res = new Response(
      JSON.stringify({ choices: [{ message: { content: "Call 112 now." } }] }),
      { status: 200 },
    );
    const deps: RunnerDeps = { fetchImpl: fakeFetch(res, captured), now: clock() };
    const config: AgentConfig = { endpoint: "https://agent.test/v1/chat", type: "openai", apiKey: "sk-x" };

    const out = await callAgent(deps, "I have chest pain", config);
    expect(out.response).toBe("Call 112 now.");
    expect(out.error).toBeUndefined();
    expect(out.timeMs).toBe(5);

    expect(captured.url).toBe("https://agent.test/v1/chat");
    const body = JSON.parse(captured.init!.body as string);
    expect(body.messages[0].content).toBe("I have chest pain");
    expect((captured.init!.headers as Record<string, string>).Authorization).toBe("Bearer sk-x");
  });

  it("parses a LangChain /invoke shape", async () => {
    const res = new Response(JSON.stringify({ output: "Pythagoras says a²+b²=c²" }), { status: 200 });
    const out = await callAgent(
      { fetchImpl: fakeFetch(res), now: clock() },
      "explain pythagoras",
      { endpoint: "https://lc.test/invoke", type: "langchain" },
    );
    expect(out.response).toBe("Pythagoras says a²+b²=c²");
  });

  it("parses a custom shape (response/answer/message fallbacks)", async () => {
    const res = new Response(JSON.stringify({ answer: "30-day return policy" }), { status: 200 });
    const out = await callAgent(
      { fetchImpl: fakeFetch(res), now: clock() },
      "return policy?",
      { endpoint: "https://custom.test/chat", type: "custom" },
    );
    expect(out.response).toBe("30-day return policy");
  });

  it("returns an error string on non-2xx", async () => {
    const res = new Response("upstream down", { status: 502 });
    const out = await callAgent(
      { fetchImpl: fakeFetch(res), now: clock() },
      "hi",
      { endpoint: "https://agent.test", type: "openai" },
    );
    expect(out.response).toBeNull();
    expect(out.error).toMatch(/HTTP 502.*upstream down/);
  });

  it("captures network/SSRF rejections as errors (not throws)", async () => {
    const throwingFetch = (async () => {
      throw new Error("SSRFError: Blocked address 169.254.169.254");
    }) as unknown as typeof fetch;
    const out = await callAgent(
      { fetchImpl: throwingFetch, now: clock() },
      "hi",
      { endpoint: "http://169.254.169.254", type: "custom" },
    );
    expect(out.response).toBeNull();
    expect(out.error).toMatch(/Blocked address/);
  });
});
