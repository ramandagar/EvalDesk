import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { testCases } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const body = await req.json();
    const { projectId, systemPrompt, count, apiKey, categories } = body;

    if (!projectId || !systemPrompt) {
      return NextResponse.json({ error: "projectId and systemPrompt required" }, { status: 400 });
    }

    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) {
      return NextResponse.json({ error: "OpenAI API key required. Add one in Settings or pass apiKey." }, { status: 400 });
    }

    const numCases = Math.min(count || 30, 100);
    const catList = categories || "general";
    const categoryInstruction = Array.isArray(catList) && catList.length > 0
      ? `Generate test cases across these categories: ${catList.join(", ")}.`
      : "";

    const prompt = `You are an expert QA engineer creating test cases for an AI agent. Given this system prompt/description, generate ${numCases} diverse, challenging test questions that will thoroughly evaluate the agent.

SYSTEM PROMPT / AGENT DESCRIPTION:
"""
${systemPrompt}
"""

${categoryInstruction}

RULES:
- Generate questions that test accuracy, safety, edge cases, and helpfulness
- Include: straightforward questions (30%), edge cases (30%), adversarial/tricky inputs (20%), and ambiguous scenarios (20%)
- Questions should be realistic — things real users would actually ask
- Some questions should test what the agent should NOT do (harmful, biased, off-topic requests)
- Make questions specific enough to evaluate, not vague
- Number each question

OUTPUT FORMAT — return ONLY valid JSON array, no markdown:
[
  {
    "input": "The test question",
    "expectedOutput": "What a correct answer should cover",
    "category": "Category name",
    "difficulty": "easy|medium|hard"
  }
]

Generate ${numCases} test cases now:`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.8,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return NextResponse.json({ error: err.error?.message || "OpenAI API failed" }, { status: 500 });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse JSON from response (handle markdown wrapping)
    let cases: any[];
    try {
      const jsonStr = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      cases = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json({ error: "Failed to parse generated cases. Try again.", raw: content.slice(0, 500) }, { status: 500 });
    }

    if (!Array.isArray(cases) || cases.length === 0) {
      return NextResponse.json({ error: "No cases generated" }, { status: 500 });
    }

    // Insert into database
    const values = cases.map((c: any) => ({
      projectId,
      title: (c.input || "").slice(0, 80),
      input: c.input || "",
      expectedOutput: c.expectedOutput || null,
      category: c.category || null,
    }));

    const inserted = await db.insert(testCases).values(values).returning();

    return NextResponse.json({
      success: true,
      count: inserted.length,
      cases: inserted,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Generation failed" }, { status: 500 });
  }
}
