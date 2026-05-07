import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-utils";
import { db } from "@/db";
import { runs, runResults, testCases, projects } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { projectId, runName } = body;
    if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

    const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const cases = await db.select().from(testCases).where(eq(testCases.projectId, projectId));
    if (cases.length === 0) return NextResponse.json({ error: "No test cases" }, { status: 400 });

    const [run] = await db.insert(runs).values({
      projectId,
      name: runName || `Streaming Run ${new Date().toLocaleDateString()}`,
      status: "running",
      totalCases: cases.length,
      triggerType: "manual",
      triggeredBy: user.id,
    }).returning();

    // Process each case with streaming chunk capture
    const apiKey = project.agentApiKey || process.env.OPENAI_API_KEY;
    const agentConfig = JSON.parse(project.agentHeaders || "{}");

    for (const tc of cases) {
      const startTime = Date.now();
      const chunks: { token: string; timestamp: number }[] = [];

      try {
        let fullResponse = "";

        if (agentConfig.type === "openai" || agentConfig.type === "openrouter") {
          const baseUrl = agentConfig.type === "openrouter" ? "https://openrouter.ai/api/v1" : "https://api.openai.com/v1";
          const res = await fetch(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
              ...(agentConfig.type === "openrouter" ? { "HTTP-Referer": "https://evaldesk.dev" } : {}),
            },
            body: JSON.stringify({
              model: agentConfig.bodyTemplate?.model || "gpt-4o-mini",
              messages: [{ role: "user", content: tc.input }],
              max_tokens: agentConfig.bodyTemplate?.max_tokens || 1000,
              stream: true,
            }),
          });

          // Capture chunks from SSE stream
          const reader = res.body?.getReader();
          if (reader) {
            const decoder = new TextDecoder();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const text = decoder.decode(value);
              const lines = text.split("\n");
              for (const line of lines) {
                if (line.startsWith("data: ") && line !== "data: [DONE]") {
                  try {
                    const json = JSON.parse(line.slice(6));
                    const token = json.choices?.[0]?.delta?.content || "";
                    if (token) {
                      fullResponse += token;
                      chunks.push({ token, timestamp: Date.now() - startTime });
                    }
                  } catch { /* skip malformed chunks */ }
                }
              }
            }
          }
        } else {
          // Non-streaming fallback
          const res = await fetch(project.agentEndpoint!, {
            method: project.agentMethod || "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ input: tc.input }),
          });
          const data = await res.json();
          fullResponse = typeof data === "string" ? data : data.response || data.output || JSON.stringify(data);
          chunks.push({ token: fullResponse, timestamp: Date.now() - startTime });
        }

        const responseTime = Date.now() - startTime;
        await db.insert(runResults).values({
          runId: run.id,
          testCaseId: tc.id,
          agentResponse: fullResponse,
          responseTime,
          status: "completed",
          streamingChunks: JSON.stringify(chunks),
        });
      } catch (e: any) {
        await db.insert(runResults).values({
          runId: run.id,
          testCaseId: tc.id,
          status: "error",
          errorMessage: e.message,
          responseTime: Date.now() - startTime,
        });
      }
    }

    // Update run stats
    const results = await db.select().from(runResults).where(eq(runResults.runId, run.id));
    const passCount = results.filter(r => r.humanRating === "pass" || r.judgeRating === "pass").length;
    const failCount = results.filter(r => r.humanRating === "fail" || r.judgeRating === "fail").length;
    const unrated = results.length - passCount - failCount;
    const passRate = results.length > 0 ? Math.round((passCount / results.length) * 100) : 0;

    await db.update(runs).set({
      status: "completed",
      totalCases: results.length,
      passCount,
      failCount,
      unratedCount: unrated,
      passRate,
      completedAt: new Date(),
    }).where(eq(runs.id, run.id));

    return NextResponse.json({ runId: run.id, totalCases: cases.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
