import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { testCases } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { generateAdversarialCases, type AdversarialType } from "@/lib/adversarial-generator";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Auth required" }, { status: 401 });

    const body = await req.json();
    const { projectId, apiKey, types, count, agentDescription, model } = body;

    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) {
      return NextResponse.json(
        { error: "OpenAI API key required. Add one in Settings or pass apiKey." },
        { status: 400 }
      );
    }

    // Validate types
    const validTypes: AdversarialType[] = ["jailbreak", "prompt_injection", "data_leak", "bias_probe"];
    const selectedTypes: AdversarialType[] = Array.isArray(types) && types.length > 0
      ? types.filter((t: string) => validTypes.includes(t as AdversarialType))
      : validTypes;

    if (selectedTypes.length === 0) {
      return NextResponse.json(
        { error: `types must be a non-empty array of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    const numCases = Math.min(count || 20, 100);

    const result = await generateAdversarialCases({
      apiKey: key,
      types: selectedTypes,
      count: numCases,
      agentDescription,
      model,
    });

    // Insert into database
    const values = result.cases.map((c) => ({
      projectId,
      title: c.input.slice(0, 80),
      input: c.input,
      expectedOutput: c.expectedOutput || null,
      category: c.category,
      difficulty: c.difficulty,
      isAdversarial: true,
      adversarialType: c.adversarialType,
      source: "ai_generated",
    }));

    const inserted = await db.insert(testCases).values(values).returning();

    return NextResponse.json({
      success: true,
      count: inserted.length,
      tokensUsed: result.tokensUsed,
      cases: inserted,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Adversarial generation failed" },
      { status: 500 }
    );
  }
}
