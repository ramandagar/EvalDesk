import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { runResults, runs, testCases } from "@/db/schema";
import { requireAuth } from "@/lib/api-utils";
import { eq, and, sql } from "drizzle-orm";

// Jaccard similarity: |A intersection B| / |A union B|
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const word of a) {
    if (b.has(word)) intersection++;
  }
  const union = new Set([...a, ...b]).size;
  return intersection / union;
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

// GET /api/analytics/clusters?projectId=xxx&threshold=0.4
// Group failing runResults by word-overlap similarity (Jaccard)
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = req.nextUrl.searchParams.get("projectId");
  const threshold = parseFloat(req.nextUrl.searchParams.get("threshold") || "0.4");

  try {
    // Get all failing results with error messages or judge reasoning indicating failure
    const projectCondition = projectId ? eq(runs.projectId, projectId) : undefined;

    const failingResults = await db
      .select({
        id: runResults.id,
        testCaseId: runResults.testCaseId,
        errorMessage: runResults.errorMessage,
        agentResponse: runResults.agentResponse,
        judgeRating: runResults.judgeRating,
        judgeReasoning: runResults.judgeReasoning,
        humanRating: runResults.humanRating,
        testCaseInput: testCases.input,
        testCaseTitle: testCases.title,
      })
      .from(runResults)
      .innerJoin(runs, eq(runResults.runId, runs.id))
      .innerJoin(testCases, eq(runResults.testCaseId, testCases.id))
      .where(
        projectCondition
          ? and(
              projectCondition,
              sql`(${runResults.humanRating} = 'fail' OR ${runResults.judgeRating} = 'fail' OR ${runResults.status} = 'error')`
            )
          : sql`(${runResults.humanRating} = 'fail' OR ${runResults.judgeRating} = 'fail' OR ${runResults.status} = 'error')`
      );

    if (failingResults.length === 0) {
      return NextResponse.json({ clusters: [] });
    }

    // Build error text for each result
    interface FailItem {
      id: string;
      testCaseId: string;
      errorText: string;
      tokens: Set<string>;
      testCaseInput: string;
      testCaseTitle: string;
    }

    const items: FailItem[] = failingResults.map((r) => {
      const parts: string[] = [];
      if (r.errorMessage) parts.push(r.errorMessage);
      if (r.judgeReasoning) parts.push(r.judgeReasoning);
      if (r.agentResponse) parts.push(r.agentResponse.slice(0, 500));
      const errorText = parts.join(" ");
      return {
        id: r.id,
        testCaseId: r.testCaseId,
        errorText,
        tokens: tokenize(errorText),
        testCaseInput: r.testCaseInput,
        testCaseTitle: r.testCaseTitle,
      };
    });

    // Simple agglomerative clustering
    // Each item starts as its own cluster, merge if jaccard > threshold
    interface Cluster {
      items: FailItem[];
      merged: boolean;
    }
    const clusters: Cluster[] = items.map((item) => ({ items: [item], merged: false }));

    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < clusters.length; i++) {
        if (clusters[i].merged) continue;
        for (let j = i + 1; j < clusters.length; j++) {
          if (clusters[j].merged) continue;
          // Compute max jaccard between any item in cluster i and cluster j
          let bestSim = 0;
          for (const a of clusters[i].items) {
            for (const b of clusters[j].items) {
              const sim = jaccard(a.tokens, b.tokens);
              if (sim > bestSim) bestSim = sim;
            }
          }
          if (bestSim >= threshold) {
            clusters[i].items.push(...clusters[j].items);
            clusters[j].merged = true;
            changed = true;
          }
        }
      }
    }

    // Build result
    const result = clusters
      .filter((c) => !c.merged)
      .sort((a, b) => b.items.length - a.items.length)
      .map((cluster) => {
        const uniqueTestCaseIds = [...new Set(cluster.items.map((item) => item.testCaseId))];
        // Pick the most common words across the cluster for label
        const wordFreq = new Map<string, number>();
        for (const item of cluster.items) {
          for (const word of item.tokens) {
            wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
          }
        }
        const topWords = [...wordFreq.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([w]) => w);
        const label = topWords.length > 0 ? topWords.join(" / ") : "Unknown error pattern";

        const sampleErrors = cluster.items.slice(0, 3).map((item) => ({
          testCaseId: item.testCaseId,
          testCaseTitle: item.testCaseTitle,
          errorSnippet: item.errorText.slice(0, 200),
        }));

        return {
          label,
          size: cluster.items.length,
          sampleErrors,
          testCaseIds: uniqueTestCaseIds,
        };
      });

    return NextResponse.json({ clusters: result });
  } catch (e: any) {
    console.error("Cluster analytics error:", e);
    return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 });
  }
}
