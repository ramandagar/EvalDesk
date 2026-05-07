/** TypeScript interfaces for the EvalDesk SDK. */

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  agentEndpoint?: string | null;
  agentMethod?: string;
  defaultModel?: string;
  costPer1kInput?: number | null;
  costPer1kOutput?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface TestCase {
  id: string;
  projectId: string;
  title: string;
  input: string;
  expectedOutput?: string | null;
  category?: string | null;
  tags?: string[] | null;
  difficulty?: string;
  createdAt?: string | null;
}

export interface Run {
  id: string;
  projectId: string;
  name?: string | null;
  status: string;
  totalCases: number;
  passCount: number;
  failCount: number;
  passRate?: number | null;
  modelUsed?: string | null;
  totalInputTokens?: number | null;
  totalOutputTokens?: number | null;
  totalCost?: number | null;
  createdAt?: string | null;
  completedAt?: string | null;
}

export interface RunResult {
  id: string;
  runId: string;
  testCaseId: string;
  agentResponse?: string | null;
  responseTime?: number | null;
  status: string;
  humanRating?: string | null;
  judgeRating?: string | null;
  judgeScore?: number | null;
  tokensInput?: number | null;
  tokensOutput?: number | null;
  cost?: number | null;
}

export interface EvaluationResult {
  run: Run;
  results: RunResult[];
  passRate?: number | null;
  totalCost?: number | null;
}

export interface ModelComparison {
  models: ModelStat[];
}

export interface ModelStat {
  model: string;
  totalRuns: number;
  avgPassRate: number;
  totalPassCount: number;
  totalFailCount: number;
  totalCases: number;
  avgResponseTime: number | null;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
}

export interface ExecutiveSummary {
  totalProjects: number;
  totalRuns: number;
  overallPassRate: number | null;
  totalTestCases: number;
  avgResponseTime: number | null;
  totalTokens: number;
  totalCost: number;
  trends: {
    passRate: TrendData;
    cost: TrendData;
    runs: TrendData;
    recentWeek: PeriodData;
    previousWeek: PeriodData;
  };
  topProjects: ProjectPerformance[];
  bottomProjects: ProjectPerformance[];
}

export interface TrendData {
  value: number;
  direction: "up" | "down" | "stable";
}

export interface PeriodData {
  runs: number;
  avgPassRate: number;
  totalCost: number;
}

export interface ProjectPerformance {
  id: string;
  name: string;
  avgPassRate: number;
  totalRuns: number;
  totalCost: number;
}

export interface CostTracking {
  totals: {
    totalCost: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    runCount: number;
  };
  daily: DailyCost[];
  byModel: ModelCost[];
  trend: {
    percentChange: number;
    direction: "up" | "down" | "stable";
  };
  period: string;
  days: number;
}

export interface DailyCost {
  date: string;
  cost: number;
  inputTokens: number;
  outputTokens: number;
  runs: number;
}

export interface ModelCost {
  model: string;
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  runCount: number;
}

export interface CreateProjectParams {
  name: string;
  description?: string;
  agentEndpoint?: string;
  agentApiKey?: string;
  defaultModel?: string;
}

export interface CreateTestCaseParams {
  projectId: string;
  title: string;
  input: string;
  expectedOutput?: string;
  category?: string;
  tags?: string[];
}

export interface RunEvaluationParams {
  projectId: string;
  name?: string;
  model?: string;
}
