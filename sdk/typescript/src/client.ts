/** Fetch-based HTTP client for the EvalDesk API. */

import type {
  Project,
  TestCase,
  Run,
  EvaluationResult,
  RunResult,
  ModelComparison,
  ExecutiveSummary,
  CostTracking,
  CreateProjectParams,
  CreateTestCaseParams,
  RunEvaluationParams,
} from "./types";

export class EvalDeskClient {
  private baseUrl: string;
  private apiKey: string;

  /**
   * Create a new EvalDesk client.
   * @param baseUrl - Base URL of the EvalDesk instance (e.g., "http://localhost:3000")
   * @param apiKey - API key for authentication
   */
  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = apiKey;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> || {}),
    };

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `EvalDesk API error: ${response.status} ${response.statusText} — ${body}`
      );
    }

    return response.json() as Promise<T>;
  }

  private get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const search = params
      ? "?" + new URLSearchParams(params).toString()
      : "";
    return this.request<T>(`${path}${search}`);
  }

  private post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  // ── Projects ─────────────────────────────────────────

  async createProject(params: CreateProjectParams): Promise<Project> {
    return this.post<Project>("/api/projects", params);
  }

  async listProjects(): Promise<Project[]> {
    const results = await this.get<Project[]>("/api/projects");
    return Array.isArray(results) ? results : [];
  }

  async getProject(projectId: string): Promise<Project> {
    return this.get<Project>(`/api/projects/${projectId}`);
  }

  // ── Test Cases ───────────────────────────────────────

  async createTestCase(params: CreateTestCaseParams): Promise<TestCase> {
    return this.post<TestCase>("/api/test-cases", params);
  }

  async listTestCases(projectId: string): Promise<TestCase[]> {
    return this.get<TestCase[]>("/api/test-cases", { projectId });
  }

  // ── Runs ─────────────────────────────────────────────

  async runEvaluation(params: RunEvaluationParams): Promise<Run> {
    return this.post<Run>("/api/run", params);
  }

  async listRuns(projectId?: string, limit = 10): Promise<Run[]> {
    const params: Record<string, string> = { limit: String(limit) };
    if (projectId) params.projectId = projectId;
    return this.get<Run[]>("/api/runs", params);
  }

  async getRun(runId: string): Promise<Run> {
    const runs = await this.get<Run[]>("/api/runs");
    const run = runs.find((r) => r.id === runId);
    if (!run) throw new Error(`Run ${runId} not found`);
    return run;
  }

  // ── Results ──────────────────────────────────────────

  async getResults(runId: string): Promise<EvaluationResult> {
    const data = await this.get<any>(`/api/run/${runId}/results`);
    return {
      run: data.run || data,
      results: Array.isArray(data.results) ? data.results : [],
      passRate: data.run?.passRate ?? data.passRate ?? null,
      totalCost: data.run?.totalCost ?? data.totalCost ?? null,
    };
  }

  // ── Analytics ────────────────────────────────────────

  async getModelComparison(projectId?: string): Promise<ModelComparison> {
    const params: Record<string, string> = {};
    if (projectId) params.projectId = projectId;
    return this.get<ModelComparison>("/api/models/compare", params);
  }

  async getExecutiveSummary(): Promise<ExecutiveSummary> {
    return this.get<ExecutiveSummary>("/api/executive");
  }

  async getCostTracking(
    projectId?: string,
    period: string = "30d"
  ): Promise<CostTracking> {
    const params: Record<string, string> = { period };
    if (projectId) params.projectId = projectId;
    return this.get<CostTracking>("/api/costs", params);
  }
}
