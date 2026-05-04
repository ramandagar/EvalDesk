import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { abTests, testCases, judgeCriteria } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId");
  const testId = req.nextUrl.searchParams.get("id");

  if (testId) {
    const [test] = await db.select().from(abTests).where(eq(abTests.id, testId));
    if (!test) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(test);
  }

  if (!projectId) return NextResponse.json({ error: "projectId or id required" }, { status: 400 });

  const tests = await db.select().from(abTests).where(eq(abTests.projectId, projectId));
  return NextResponse.json(tests);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  try {
    const body = await req.json();
    const { projectId, name, promptA, promptB, modelA, modelB, apiKey } = body;

    if (!projectId || !name || !promptA || !promptB) {
      return NextResponse.json({ error: "projectId, name, promptA, promptB required" }, { status: 400 });
    }

    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) {
      return NextResponse.json({ error: "OpenAI API key required" }, { status: 400 });
    }

    // Get test cases for this project
    const cases = await db.select().from(testCases).where(eq(testCases.projectId, projectId));
    if (cases.length === 0) {
      return NextResponse.json({ error: "No test cases in this project. Add test cases first." }, { status: 400 });
    }

    // Create the A/B test record
    const [abTest] = await db.insert(abTests).values({
      projectId,
      name,
      promptA,
      promptB,
      modelA: modelA || "gpt-4o-mini",
      modelB: modelB || "gpt-4o-mini",
      status: "running",
    }).returning();

    // Run the test asynchronously — send promptA and promptB against all test cases
    runABTest(abTest.id, cases, promptA, promptB, modelA || "gpt-4o-mini", modelB || "gpt-4o-mini", key).catch(() => {});

    return NextResponse.json(abTest);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed" }, { status: 500 });
  }
}

async function runABTest(
  testId: string,
  cases: any[],
  promptA: string,
  promptB: string,
  modelA: string,
  modelB: string,
  apiKey: string
) {
  try {
    const resultsA: any[] = [];
    const resultsB: any[] = [];
    const maxCases = Math.min(cases.length, 50); // Limit to 50 cases

    for (let i = 0; i < maxCases; i++) {
      const tc = cases[i];
      const userMsg = tc.input;

      // Run prompt A
      try {
        const resA = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: modelA,
            messages: [
              { role: "system", content: promptA },
              { role: "user", content: userMsg },
            ],
            temperature: 0,
          }),
        });
        const dataA = await resA.json();
        const responseA = dataA.choices?.[0]?.message?.content || "No response";
        resultsA.push({ testCaseId: tc.id, input: userMsg, response: responseA, expected: tc.expectedOutput });
      } catch {
        resultsA.push({ testCaseId: tc.id, input: userMsg, response: "Error", expected: tc.expectedOutput });
      }

      // Run prompt B
      try {
        const resB = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: modelB,
            messages: [
              { role: "system", content: promptB },
              { role: "user", content: userMsg },
            ],
            temperature: 0,
          }),
        });
        const dataB = await resB.json();
        const responseB = dataB.choices?.[0]?.message?.content || "No response";
        resultsB.push({ testCaseId: tc.id, input: userMsg, response: responseB, expected: tc.expectedOutput });
      } catch {
        resultsB.push({ testCaseId: tc.id, input: userMsg, response: "Error", expected: tc.expectedOutput });
      }
    }

    // Now judge all pairs
    const judgePrompt = (userMsg: string, expected: string, responseA: string, responseB: string) =>
      `Compare two AI agent responses to the same question. Judge which is better.

QUESTION: ${userMsg}
${expected ? `EXPECTED: ${expected}` : ""}

RESPONSE A: ${responseA}

RESPONSE B: ${responseB}

Rate each response 0-100 and pick the winner.

Reply in this exact format:
SCORE_A: [0-100]
SCORE_B: [0-100]
WINNER: [A/B/tie]
REASONING: [one sentence]`;

    let totalScoreA = 0;
    let totalScoreB = 0;
    let winsA = 0;
    let winsB = 0;
    let ties = 0;

    for (let i = 0; i < resultsA.length; i++) {
      try {
        const judgeRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: judgePrompt(resultsA[i].input, resultsA[i].expected, resultsA[i].response, resultsB[i].response) }],
            temperature: 0,
            max_tokens: 200,
          }),
        });
        const judgeData = await judgeRes.json();
        const content = judgeData.choices?.[0]?.message?.content || "";

        const scoreA = parseInt(content.match(/SCORE_A:\s*(\d+)/)?.[1] || "50");
        const scoreB = parseInt(content.match(/SCORE_B:\s*(\d+)/)?.[1] || "50");
        const winner = content.match(/WINNER:\s*(A|B|tie)/i)?.[1]?.toLowerCase() || "tie";
        const reasoning = content.match(/REASONING:\s*(.+)/)?.[1]?.trim() || "";

        resultsA[i].score = scoreA;
        resultsB[i].score = scoreB;
        resultsA[i].winner = winner;
        resultsB[i].winner = winner;
        resultsA[i].reasoning = reasoning;
        resultsB[i].reasoning = reasoning;

        totalScoreA += scoreA;
        totalScoreB += scoreB;
        if (winner === "a") winsA++;
        else if (winner === "b") winsB++;
        else ties++;
      } catch {
        resultsA[i].score = 0;
        resultsB[i].score = 0;
        resultsA[i].winner = "tie";
        resultsB[i].winner = "tie";
      }
    }

    const n = resultsA.length;
    const summary = {
      totalCases: n,
      avgScoreA: Math.round(totalScoreA / n),
      avgScoreB: Math.round(totalScoreB / n),
      winsA,
      winsB,
      ties,
      winner: totalScoreA > totalScoreB ? "A" : totalScoreB > totalScoreA ? "B" : "tie",
      scoreDelta: Math.abs(totalScoreA - totalScoreB) / n,
    };

    await db.update(abTests).set({
      status: "completed",
      resultsA: JSON.stringify(resultsA),
      resultsB: JSON.stringify(resultsB),
      summary: JSON.stringify(summary),
      completedAt: new Date(),
    }).where(eq(abTests.id, testId));
  } catch (error) {
    await db.update(abTests).set({ status: "failed" }).where(eq(abTests.id, testId));
  }
}
