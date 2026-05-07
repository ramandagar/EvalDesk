import { db } from "@/db";
import { runResults, citationChecks, testCases } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function checkCitations(runResultId: string, apiKey?: string) {
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OpenAI API key required");

  const [result] = await db.select().from(runResults).where(eq(runResults.id, runResultId));
  if (!result) throw new Error("Run result not found");

  const response = result.agentResponse || "";

  // Extract citations from response (URLs and quoted claims)
  const urlRegex = /https?:\/\/[^\s)"'<>]+/g;
  const urls = response.match(urlRegex) || [];

  // Also extract quoted claims ("according to...", "research shows...")
  const claimRegex = /[""]([^""]{20,})[""]/g;
  const claims: string[] = [];
  let match;
  while ((match = claimRegex.exec(response)) !== null) {
    claims.push(match[1]);
  }

  const citations = [...urls.map(u => ({ text: u, type: "url" as const })), ...claims.map(c => ({ text: c, type: "claim" as const }))];

  if (citations.length === 0) {
    return { citations: [], verifiedCount: 0, totalCount: 0 };
  }

  // Check each citation via LLM
  const results = [];
  for (const citation of citations) {
    const prompt = `You are a citation verification expert. Analyze this citation from an AI agent's response:

CITATION: ${citation.text}
TYPE: ${citation.type}

${citation.type === "url" ? "Does this URL look like a real, verifiable source? Check the domain format and path." : "Is this claim likely to be verifiable from a real source? Is it specific enough to be checked?"}

Reply in EXACTLY this format:
STATUS: [verified/unverified/contradicted]
NOTES: [one sentence explanation]`;

    const llmResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        max_tokens: 150,
      }),
    });

    const data = await llmResponse.json();
    const content = data.choices?.[0]?.message?.content || "";

    const statusMatch = content.match(/STATUS:\s*(verified|unverified|contradicted)/i);
    const notesMatch = content.match(/NOTES:\s*(.+)/);

    const status = (statusMatch?.[1]?.toLowerCase() || "unverified") as "verified" | "unverified" | "contradicted";
    const notes = notesMatch?.[1]?.trim() || "";
    const isVerified = status === "verified" ? 1 : 0;

    await db.insert(citationChecks).values({
      runResultId,
      citationText: citation.text,
      sourceUrl: citation.type === "url" ? citation.text : null,
      isVerified,
      verificationStatus: status,
      notes,
    });

    results.push({ text: citation.text, status, notes, type: citation.type });
  }

  const verifiedCount = results.filter(r => r.status === "verified").length;
  return { citations: results, verifiedCount, totalCount: results.length };
}
