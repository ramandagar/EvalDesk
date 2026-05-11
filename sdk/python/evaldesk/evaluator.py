"""High-level evaluation helpers for the EvalDesk SDK."""

from typing import Optional, List, Dict, Any

from .client import EvalDeskClient
from .models import Project, TestCase, Run, EvaluationResult


class Evaluator:
    """High-level evaluator for running AI agent evaluations.

    Wraps the EvalDeskClient to provide a simpler interface for common
    evaluation workflows.

    Args:
        base_url: Base URL of the EvalDesk instance.
        api_key: API key for authentication.
    """

    def __init__(self, base_url: str, api_key: str):
        self.client = EvalDeskClient(base_url, api_key)

    def evaluate(
        self,
        project_name: str,
        test_cases: List[Dict[str, str]],
        agent_endpoint: Optional[str] = None,
        agent_api_key: Optional[str] = None,
        model: Optional[str] = None,
    ) -> EvaluationResult:
        """Run a full evaluation: create project, add cases, run eval.

        Args:
            project_name: Name for the project.
            test_cases: List of dicts with 'input' and optionally
                        'expected_output', 'category', 'title'.
            agent_endpoint: URL of the agent to evaluate.
            agent_api_key: API key for the agent.
            model: Model to use for judging.

        Returns:
            EvaluationResult with the run and individual results.
        """
        # Create project
        project = self.client.create_project(
            name=project_name,
            agent_endpoint=agent_endpoint,
            agent_api_key=agent_api_key,
            default_model=model or "gpt-4o-mini",
        )

        # Add test cases
        for tc in test_cases:
            self.client.create_test_case(
                project_id=project.id,
                title=tc.get("title", tc["input"][:80]),
                input=tc["input"],
                expected_output=tc.get("expected_output"),
                category=tc.get("category"),
            )

        # Run evaluation
        run = self.client.run_evaluation(
            project_id=project.id,
            name=f"Evaluation of {project_name}",
            model=model,
        )

        return self.client.get_results(run.id)

    def quick_eval(
        self,
        agent_endpoint: str,
        inputs: List[str],
        expected_outputs: Optional[List[str]] = None,
        agent_api_key: Optional[str] = None,
    ) -> EvaluationResult:
        """Quick evaluation: pass inputs and expected outputs directly.

        Args:
            agent_endpoint: URL of the agent to evaluate.
            inputs: List of input strings to test.
            expected_outputs: Optional list of expected output strings.
            agent_api_key: API key for the agent.

        Returns:
            EvaluationResult with the run and individual results.
        """
        test_cases: List[Dict[str, str]] = []
        for i, inp in enumerate(inputs):
            tc: Dict[str, str] = {"input": inp}
            if expected_outputs and i < len(expected_outputs):
                tc["expected_output"] = expected_outputs[i]
            test_cases.append(tc)

        return self.evaluate(
            project_name=f"Quick Eval {len(inputs)} cases",
            test_cases=test_cases,
            agent_endpoint=agent_endpoint,
            agent_api_key=agent_api_key,
        )

    def benchmark(
        self,
        project_id: str,
        baseline_run_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Compare the latest run against a baseline.

        Args:
            project_id: Project ID to benchmark.
            baseline_run_id: Optional specific baseline run ID.
                             If not provided, uses the second-to-last run.

        Returns:
            Dict with comparison data including delta metrics.
        """
        runs = self.client.list_runs(project_id=project_id, limit=10)
        if len(runs) < 2:
            return {"error": "Need at least 2 runs to benchmark"}

        latest = runs[-1]
        baseline = None
        if baseline_run_id:
            for r in runs:
                if r.id == baseline_run_id:
                    baseline = r
                    break
        if not baseline:
            baseline = runs[-2]

        latest_results = self.client.get_results(latest.id)
        baseline_results = self.client.get_results(baseline.id)

        return {
            "latest_run": {
                "id": latest.id,
                "name": latest.name,
                "pass_rate": latest.pass_rate,
                "total_cases": latest.total_cases,
            },
            "baseline_run": {
                "id": baseline.id,
                "name": baseline.name,
                "pass_rate": baseline.pass_rate,
                "total_cases": baseline.total_cases,
            },
            "delta_pass_rate": (latest.pass_rate or 0) - (baseline.pass_rate or 0),
            "latest_passed": latest_results.passed,
            "latest_failed": latest_results.failed,
            "baseline_passed": baseline_results.passed,
            "baseline_failed": baseline_results.failed,
        }
