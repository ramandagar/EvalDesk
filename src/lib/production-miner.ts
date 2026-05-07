/**
 * Production log miner — parse production conversation logs into test case candidates.
 * Accepts JSON arrays of {userMessage, agentResponse, wasHelpful} and converts them
 * into structured test cases.
 */

export interface ProductionLogEntry {
  userMessage: string;
  agentResponse: string;
  wasHelpful?: boolean;
  timestamp?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export interface MinedTestCase {
  input: string;
  expectedOutput: string | null;
  title: string;
  category: string;
  source: "production";
  tags: string;
  difficulty: string;
}

export interface MiningResult {
  totalLogs: number;
  minedCases: number;
  skippedEmpty: number;
  skippedUnhelpful: number;
  cases: MinedTestCase[];
}

/**
 * Estimate difficulty based on input characteristics.
 */
function estimateDifficulty(input: string): string {
  const len = input.length;
  const hasMultipleQuestions = (input.match(/\?/g) || []).length > 1;
  const hasNegation = /\b(not|don't|won't|can't|never|no)\b/i.test(input);
  const hasEdgeCaseKeywords = /\b(edge case|unusual|rare|exception|corner|boundary|weird)\b/i.test(input);

  if (hasEdgeCaseKeywords || (len > 200 && hasMultipleQuestions)) return "hard";
  if (hasNegation || hasMultipleQuestions || len > 100) return "medium";
  return "easy";
}

/**
 * Infer a category from the content of the message.
 */
function inferCategory(input: string): string {
  const categoryPatterns: [RegExp, string][] = [
    [/\b(price|cost|payment|billing|refund|subscription)\b/i, "billing"],
    [/\b(bug|error|crash|broken|fix|issue)\b/i, "troubleshooting"],
    [/\b(how|what|when|where|why|explain|describe)\b/i, "informational"],
    [/\b(setup|install|configure|deploy|integrate)\b/i, "setup"],
    [/\b(cancel|delete|remove|unsubscribe)\b/i, "account_management"],
    [/\b(hello|hi|hey|help|support)\b/i, "greeting"],
    [/\b(compare|difference|versus|vs|better)\b/i, "comparison"],
    [/\b(feedback|suggest|improve|feature|request)\b/i, "feedback"],
  ];

  for (const [pattern, category] of categoryPatterns) {
    if (pattern.test(input)) return category;
  }

  return "general";
}

/**
 * Generate a concise title from a user message.
 */
function generateTitle(input: string): string {
  const cleaned = input.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 80) return cleaned;
  // Try to cut at a sentence boundary
  const firstSentence = cleaned.match(/^(.{20,80}?[.!?])\s/);
  if (firstSentence) return firstSentence[1];
  // Cut at a word boundary
  const truncated = cleaned.slice(0, 77);
  const lastSpace = truncated.lastIndexOf(" ");
  return truncated.slice(0, lastSpace > 0 ? lastSpace : 77) + "...";
}

/**
 * Mine production logs into test case candidates.
 *
 * @param logs - Array of production log entries
 * @param options - Mining options
 * @returns Mining result with statistics and generated test cases
 */
export function mineProductionLogs(
  logs: ProductionLogEntry[],
  options: {
    /** Only include logs where wasHelpful=true. Default: false (include all) */
    onlyHelpful?: boolean;
    /** Skip entries where userMessage is shorter than this. Default: 5 */
    minInputLength?: number;
    /** Skip entries where agentResponse is shorter than this when using as expectedOutput. Default: 10 */
    minOutputLength?: number;
    /** Max number of cases to return. Default: unlimited */
    maxCases?: number;
    /** Tags to add to all mined cases */
    extraTags?: string[];
  } = {}
): MiningResult {
  const {
    onlyHelpful = false,
    minInputLength = 5,
    minOutputLength = 10,
    maxCases,
    extraTags = [],
  } = options;

  let skippedEmpty = 0;
  let skippedUnhelpful = 0;
  const cases: MinedTestCase[] = [];

  for (const log of logs) {
    if (!log.userMessage || log.userMessage.trim().length < minInputLength) {
      skippedEmpty++;
      continue;
    }

    // Skip explicitly unhelpful responses if configured
    if (log.wasHelpful === false && onlyHelpful) {
      skippedUnhelpful++;
      continue;
    }

    // Determine expectedOutput: only use agentResponse if it was helpful
    let expectedOutput: string | null = null;
    if (log.wasHelpful !== false && log.agentResponse && log.agentResponse.trim().length >= minOutputLength) {
      expectedOutput = log.agentResponse.trim();
    }

    const input = log.userMessage.trim();
    const tags = [...extraTags, "production-mined"];
    if (log.wasHelpful === true) tags.push("verified-helpful");
    if (log.wasHelpful === false) tags.push("flagged-unhelpful");

    cases.push({
      input,
      expectedOutput,
      title: generateTitle(input),
      category: inferCategory(input),
      source: "production",
      tags: JSON.stringify(tags),
      difficulty: estimateDifficulty(input),
    });

    if (maxCases && cases.length >= maxCases) break;
  }

  return {
    totalLogs: logs.length,
    minedCases: cases.length,
    skippedEmpty,
    skippedUnhelpful,
    cases,
  };
}

/**
 * Validate that a raw string can be parsed as production logs.
 * Returns parsed logs or throws a descriptive error.
 */
export function parseProductionLogs(raw: string): ProductionLogEntry[] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON. Please provide a JSON array of conversation logs.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Expected a JSON array of log entries.");
  }

  // Validate structure
  const validated: ProductionLogEntry[] = [];
  const errors: string[] = [];

  for (let i = 0; i < parsed.length; i++) {
    const entry = parsed[i];
    if (!entry || typeof entry !== "object") {
      errors.push(`Entry ${i}: must be an object`);
      continue;
    }
    if (!entry.userMessage || typeof entry.userMessage !== "string") {
      errors.push(`Entry ${i}: missing or invalid "userMessage" string`);
      continue;
    }
    if (entry.agentResponse !== undefined && typeof entry.agentResponse !== "string") {
      errors.push(`Entry ${i}: "agentResponse" must be a string if provided`);
      continue;
    }
    if (entry.wasHelpful !== undefined && typeof entry.wasHelpful !== "boolean") {
      errors.push(`Entry ${i}: "wasHelpful" must be a boolean if provided`);
      continue;
    }

    validated.push({
      userMessage: entry.userMessage,
      agentResponse: entry.agentResponse || "",
      wasHelpful: entry.wasHelpful,
      timestamp: entry.timestamp,
      sessionId: entry.sessionId,
      metadata: entry.metadata,
    });
  }

  if (errors.length > 0 && validated.length === 0) {
    throw new Error("All entries are invalid:\n" + errors.join("\n"));
  }

  return validated;
}
