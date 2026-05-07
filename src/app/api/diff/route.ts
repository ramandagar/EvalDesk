import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { runResults, testCases, runs } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// GET /api/diff?testCaseId=xxx&runA=xxx&runB=xxx
export async function GET(req: NextRequest) {
  const testCaseId = req.nextUrl.searchParams.get("testCaseId");
  const runAId = req.nextUrl.searchParams.get("runA");
  const runBId = req.nextUrl.searchParams.get("runB");

  if (!testCaseId || !runAId || !runBId) {
    return NextResponse.json(
      { error: "testCaseId, runA, and runB are required" },
      { status: 400 }
    );
  }

  if (runAId === runBId) {
    return NextResponse.json({ error: "runA and runB must be different runs" }, { status: 400 });
  }

  try {
    // Get the test case
    const [testCase] = await db.select().from(testCases).where(eq(testCases.id, testCaseId));
    if (!testCase) return NextResponse.json({ error: "Test case not found" }, { status: 404 });

    // Get both runs
    const [runA] = await db.select().from(runs).where(eq(runs.id, runAId));
    const [runB] = await db.select().from(runs).where(eq(runs.id, runBId));

    // Get results for this test case from both runs
    const [resultA] = await db
      .select()
      .from(runResults)
      .where(and(eq(runResults.runId, runAId), eq(runResults.testCaseId, testCaseId)));

    const [resultB] = await db
      .select()
      .from(runResults)
      .where(and(eq(runResults.runId, runBId), eq(runResults.testCaseId, testCaseId)));

    if (!resultA && !resultB) {
      return NextResponse.json(
        { error: "No results found for this test case in either run" },
        { status: 404 }
      );
    }

    // Compute word-level diff
    const textA = resultA?.agentResponse || "";
    const textB = resultB?.agentResponse || "";
    const diff = computeWordDiff(textA, textB);

    return NextResponse.json({
      testCase: {
        id: testCase.id,
        title: testCase.title,
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        category: testCase.category,
      },
      runA: runA ? { id: runA.id, name: runA.name, createdAt: runA.createdAt?.toISOString() } : null,
      runB: runB ? { id: runB.id, name: runB.name, createdAt: runB.createdAt?.toISOString() } : null,
      resultA: resultA
        ? {
            id: resultA.id,
            agentResponse: resultA.agentResponse,
            responseTime: resultA.responseTime,
            status: resultA.status,
            errorMessage: resultA.errorMessage,
            humanRating: resultA.humanRating,
            judgeRating: resultA.judgeRating,
            judgeScore: resultA.judgeScore,
          }
        : null,
      resultB: resultB
        ? {
            id: resultB.id,
            agentResponse: resultB.agentResponse,
            responseTime: resultB.responseTime,
            status: resultB.status,
            errorMessage: resultB.errorMessage,
            humanRating: resultB.humanRating,
            judgeRating: resultB.judgeRating,
            judgeScore: resultB.judgeScore,
          }
        : null,
      diff,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

interface DiffSegment {
  type: "same" | "added" | "removed";
  value: string;
}

function computeWordDiff(textA: string, textB: string): DiffSegment[] {
  if (textA === textB) {
    return textA ? [{ type: "same", value: textA }] : [];
  }

  const wordsA = tokenize(textA);
  const wordsB = tokenize(textB);

  // LCS-based diff
  const lcs = computeLCS(wordsA, wordsB);
  const result: DiffSegment[] = [];

  let iA = 0;
  let iB = 0;
  let iL = 0;

  while (iA < wordsA.length || iB < wordsB.length) {
    if (iL < lcs.length && iA < wordsA.length && iB < wordsB.length && wordsA[iA] === lcs[iL] && wordsB[iB] === lcs[iL]) {
      // Same
      if (result.length > 0 && result[result.length - 1].type === "same") {
        result[result.length - 1].value += wordsA[iA];
      } else {
        result.push({ type: "same", value: wordsA[iA] });
      }
      iA++;
      iB++;
      iL++;
    } else {
      // Removed from A
      if (iA < wordsA.length && (iL >= lcs.length || wordsA[iA] !== lcs[iL])) {
        if (result.length > 0 && result[result.length - 1].type === "removed") {
          result[result.length - 1].value += wordsA[iA];
        } else {
          result.push({ type: "removed", value: wordsA[iA] });
        }
        iA++;
      }
      // Added in B
      if (iB < wordsB.length && (iL >= lcs.length || wordsB[iB] !== lcs[iL])) {
        if (result.length > 0 && result[result.length - 1].type === "added") {
          result[result.length - 1].value += wordsB[iB];
        } else {
          result.push({ type: "added", value: wordsB[iB] });
        }
        iB++;
      }
    }
  }

  return result;
}

function tokenize(text: string): string[] {
  // Split into words while preserving whitespace
  const tokens: string[] = [];
  const regex = /\S+|\s+/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    tokens.push(match[0]);
  }
  return tokens.length > 0 ? tokens : [text];
}

function computeLCS(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;

  // For very long texts, use a simplified approach
  if (m * n > 1_000_000) {
    return simplifiedDiff(a, b);
  }

  // Build DP table
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find LCS
  const result: string[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return result;
}

function simplifiedDiff(a: string[], b: string[]): string[] {
  // Fallback for large texts — just return common prefix + suffix
  const common: string[] = [];
  const minLen = Math.min(a.length, b.length);
  for (let i = 0; i < minLen; i++) {
    if (a[i] === b[i]) common.push(a[i]);
    else break;
  }
  return common;
}
