"""HTTP client for the EvalDesk API."""

import json
from typing import Optional, List, Dict, Any

import requests

from .models import Project, TestCase, Run, RunResult, EvaluationResult


class EvalDeskClient:
    """Client for interacting with the EvalDesk API.

    Args:
        base_url: Base URL of the EvalDesk instance (e.g., "http://localhost:3000").
        api_key: API key for authentication.
    """

    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self._session = requests.Session()
        self._session.headers.update({
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        })

    def _url(self, path: str) -> str:
        return f"{self.base_url}{path}"

    def _get(self, path: str, params: Optional[Dict[str, Any]] = None) -> Any:
        resp = self._session.get(self._url(path), params=params)
        resp.raise_for_status()
        return resp.json()

    def _post(self, path: str, data: Optional[Dict[str, Any]] = None) -> Any:
        resp = self._session.post(self._url(path), json=data)
        resp.raise_for_status()
        return resp.json()

    # ── Projects ──────────────────────────────────────────

    def create_project(
        self,
        name: str,
        description: Optional[str] = None,
        agent_endpoint: Optional[str] = None,
        agent_api_key: Optional[str] = None,
        default_model: str = "gpt-4o-mini",
    ) -> Project:
        """Create a new evaluation project."""
        data: Dict[str, Any] = {
            "name": name,
            "defaultModel": default_model,
        }
        if description:
            data["description"] = description
        if agent_endpoint:
            data["agentEndpoint"] = agent_endpoint
        if agent_api_key:
            data["agentApiKey"] = agent_api_key

        result = self._post("/api/projects", data)
        return Project.from_dict(result)

    def list_projects(self) -> List[Project]:
        """List all projects."""
        results = self._get("/api/projects")
        if isinstance(results, list):
            return [Project.from_dict(p) for p in results]
        return [Project.from_dict(p) for p in results.get("projects", [])]

    def get_project(self, project_id: str) -> Project:
        """Get a project by ID."""
        result = self._get(f"/api/projects/{project_id}")
        return Project.from_dict(result)

    # ── Test Cases ────────────────────────────────────────

    def create_test_case(
        self,
        project_id: str,
        title: str,
        input: str,
        expected_output: Optional[str] = None,
        category: Optional[str] = None,
        tags: Optional[List[str]] = None,
    ) -> TestCase:
        """Create a test case within a project."""
        data: Dict[str, Any] = {
            "projectId": project_id,
            "title": title,
            "input": input,
        }
        if expected_output:
            data["expectedOutput"] = expected_output
        if category:
            data["category"] = category
        if tags:
            data["tags"] = json.dumps(tags)

        result = self._post("/api/test-cases", data)
        return TestCase.from_dict(result)

    def list_test_cases(self, project_id: str) -> List[TestCase]:
        """List test cases for a project."""
        results = self._get("/api/test-cases", params={"projectId": project_id})
        return [TestCase.from_dict(tc) for tc in results]

    # ── Runs ──────────────────────────────────────────────

    def run_evaluation(
        self,
        project_id: str,
        name: Optional[str] = None,
        model: Optional[str] = None,
    ) -> Run:
        """Trigger an evaluation run for a project."""
        data: Dict[str, Any] = {"projectId": project_id}
        if name:
            data["name"] = name
        if model:
            data["model"] = model

        result = self._post("/api/run", data)
        return Run.from_dict(result)

    def list_runs(self, project_id: Optional[str] = None, limit: int = 10) -> List[Run]:
        """List runs, optionally filtered by project."""
        params: Dict[str, Any] = {"limit": str(limit)}
        if project_id:
            params["projectId"] = project_id
        results = self._get("/api/runs", params=params)
        return [Run.from_dict(r) for r in results]

    def get_run(self, run_id: str) -> Run:
        """Get a run by ID."""
        results = self._get("/api/runs")
        for r in results:
            if r.get("id") == run_id:
                return Run.from_dict(r)
        raise ValueError(f"Run {run_id} not found")

    # ── Results ───────────────────────────────────────────

    def get_results(self, run_id: str) -> EvaluationResult:
        """Get full results for a run, including individual test case results."""
        run_data = self._get(f"/api/run/{run_id}/results")
        run = Run.from_dict(run_data.get("run", run_data))

        results_list = run_data.get("results", [])
        if isinstance(results_list, list):
            results = [RunResult.from_dict(r) for r in results_list]
        else:
            results = []

        return EvaluationResult(
            run=run,
            results=results,
            pass_rate=run.pass_rate,
            total_cost=run.total_cost,
        )

    # ── Analytics ─────────────────────────────────────────

    def get_model_comparison(self, project_id: Optional[str] = None) -> Dict[str, Any]:
        """Get model comparison data."""
        params = {}
        if project_id:
            params["projectId"] = project_id
        return self._get("/api/models/compare", params=params)

    def get_executive_summary(self) -> Dict[str, Any]:
        """Get executive dashboard data."""
        return self._get("/api/executive")

    def get_cost_tracking(
        self,
        project_id: Optional[str] = None,
        period: str = "30d",
    ) -> Dict[str, Any]:
        """Get cost tracking data."""
        params: Dict[str, Any] = {"period": period}
        if project_id:
            params["projectId"] = project_id
        return self._get("/api/costs", params=params)
