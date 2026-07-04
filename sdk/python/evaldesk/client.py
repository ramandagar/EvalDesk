import time
from typing import Optional, List

import requests

from .exceptions import EvalDeskError
from .types import Project, Run, TestCase

TERMINAL_STATUSES = {"completed", "failed", "signed"}


class EvalDesk:
    """Client for the EvalDesk REST API.

    Args:
        base_url: Root URL of the EvalDesk instance (e.g. "https://app.evaldesk.dev").
        token: Session token obtained from the web app or the /auth/login endpoint.
        org: Organisation ID (X-Org-Id header value).
    """

    def __init__(self, base_url: str, token: str, org: str):
        self.base_url = base_url.rstrip("/")
        self.org = org
        self._session = requests.Session()
        self._session.headers.update({
            "x-org-id": org,
            "cookie": f"evaldesk_session={token}",
            "content-type": "application/json",
        })

    # ── Internal helpers ─────────────────────────────────

    def _get(self, path: str) -> dict:
        r = self._session.get(f"{self.base_url}/api/v1{path}")
        if not r.ok:
            raise EvalDeskError(r.status_code, r.json().get("error", f"HTTP {r.status_code}"))
        return r.json()

    def _post(self, path: str, body: Optional[dict] = None) -> dict:
        r = self._session.post(f"{self.base_url}/api/v1{path}", json=body or {})
        if not r.ok:
            raise EvalDeskError(r.status_code, r.json().get("error", f"HTTP {r.status_code}"))
        return r.json()

    # ── Identity ─────────────────────────────────────────

    def me(self) -> dict:
        """Return the current user + org membership info."""
        return self._get("/me")

    # ── Projects ─────────────────────────────────────────

    @property
    def projects(self) -> "_Projects":
        return _Projects(self)

    # ── Test cases ───────────────────────────────────────

    @property
    def test_cases(self) -> "_TestCases":
        return _TestCases(self)

    # ── Runs ─────────────────────────────────────────────

    @property
    def runs(self) -> "_Runs":
        return _Runs(self)

    # ── Certificates ─────────────────────────────────────

    def get_certificate(self, run_id: str) -> dict:
        """Fetch the Ed25519-signed compliance certificate for a finalised run."""
        return self._get(f"/runs/{run_id}/certificate").get("certificate")


# ── Sub-resource namespaces ───────────────────────────────────────────────────


class _Projects:
    def __init__(self, client: EvalDesk):
        self._c = client

    def list(self) -> List[Project]:
        """List all projects in the org."""
        return self._c._get("/projects")["projects"]

    def get(self, project_id: str) -> Project:
        """Fetch a single project by ID."""
        return self._c._get(f"/projects/{project_id}")["project"]

    def create(
        self,
        name: str,
        agent_endpoint: Optional[str] = None,
        agent_api_key: Optional[str] = None,
        judge_base_url: Optional[str] = None,
        judge_model: Optional[str] = None,
        judge_api_key: Optional[str] = None,
    ) -> Project:
        """Create a new project, optionally with an agent endpoint and judge config."""
        body: dict = {"name": name}
        if agent_endpoint:
            body["agentEndpoint"] = agent_endpoint
        if agent_api_key:
            body["agentApiKey"] = agent_api_key
        if judge_base_url:
            body["judgeBaseUrl"] = judge_base_url
        if judge_model:
            body["judgeModel"] = judge_model
        if judge_api_key:
            body["judgeApiKey"] = judge_api_key
        return self._c._post("/projects", body)["project"]


class _TestCases:
    def __init__(self, client: EvalDesk):
        self._c = client

    def list(self, project_id: str) -> List[TestCase]:
        """List all test cases in a project."""
        return self._c._get(f"/test-cases?projectId={project_id}")["testCases"]

    def create(
        self,
        project_id: str,
        title: str,
        input: str,
        expected_output: Optional[str] = None,
        context: Optional[str] = None,
        category: Optional[str] = None,
    ) -> TestCase:
        """Create a single test case. Set *context* for RAG faithfulness eval."""
        body: dict = {"projectId": project_id, "title": title, "input": input}
        if expected_output:
            body["expectedOutput"] = expected_output
        if context:
            body["context"] = context
        if category:
            body["category"] = category
        return self._c._post("/test-cases", body)["testCase"]

    def import_dataset(self, project_id: str, data: str) -> dict:
        """Bulk-import a deepeval/langfuse/openai-evals dataset (JSONL or JSON string)."""
        return self._c._post("/imports", {"projectId": project_id, "data": data})["result"]

    def generate_probes(
        self,
        project_id: str,
        probe_type: str = "jailbreak",
        count: int = 5,
    ) -> dict:
        """Enqueue adversarial probe generation (jailbreak | prompt_injection | pii_leak).

        Returns immediately with ``{"queued": True}``; probes appear as test cases
        once the worker finishes (typically < 30 s).
        """
        return self._c._post(
            f"/projects/{project_id}/probes",
            {"type": probe_type, "count": count},
        )


class _Runs:
    def __init__(self, client: EvalDesk):
        self._c = client

    def create(self, project_id: str) -> Run:
        """Trigger a new evaluation run for a project."""
        return self._c._post("/runs", {"projectId": project_id})["run"]

    def get(self, run_id: str) -> Run:
        """Fetch a run by ID."""
        return self._c._get(f"/runs/{run_id}")["run"]

    def list(self, project_id: Optional[str] = None) -> List[Run]:
        """List runs — optionally scoped to a project."""
        path = f"/runs?projectId={project_id}" if project_id else "/runs"
        return self._c._get(path)["runs"]

    def report(self, run_id: str) -> dict:
        """Full per-result report including AI scores, human ratings, tokens, and cost."""
        return self._c._get(f"/runs/{run_id}/results")

    def coverage(self, run_id: str, suite: str = "hipaa") -> dict:
        """Compliance control-coverage matrix for a run (HIPAA or EU-AI-Act)."""
        return self._c._get(f"/runs/{run_id}/coverage?suite={suite}")

    def signoff(self, run_id: str, decision: str = "approve") -> dict:
        """Submit a human sign-off decision (approve | reject)."""
        return self._c._post(f"/runs/{run_id}/signoff", {"decision": decision})

    def wait(
        self,
        run_id: str,
        timeout: int = 300,
        poll_interval: float = 2.5,
    ) -> Run:
        """Poll until the run reaches a terminal status, then return it.

        Raises:
            EvalDeskError: If the run does not finish within *timeout* seconds.
        """
        start = time.monotonic()
        while True:
            run = self.get(run_id)
            if run["status"] in TERMINAL_STATUSES:
                return run
            if time.monotonic() - start > timeout:
                raise EvalDeskError(
                    408,
                    f"Run {run_id} did not finish within {timeout}s",
                )
            time.sleep(poll_interval)


# ── CI gate ───────────────────────────────────────────────────────────────────


def assert_run_passes(
    run: Run,
    min_pass_rate: Optional[float] = None,
    max_failures: Optional[int] = None,
) -> None:
    """DeepEval-parity CI gate.  Raises :class:`EvalDeskError` if the run misses the bar.

    Args:
        run: A :class:`~evaldesk.types.Run` dict (from ``runs.get()`` or ``runs.wait()``).
        min_pass_rate: Minimum acceptable pass rate in [0, 1].  e.g. ``0.9`` = 90 %.
        max_failures: Maximum number of ``"fail"`` verdicts allowed.

    Example::

        run = client.runs.wait(run["id"])
        assert_run_passes(run, min_pass_rate=0.95, max_failures=0)
    """
    decided = run["passCount"] + run["failCount"] + run["partialCount"]
    pass_rate = run["passCount"] / decided if decided > 0 else 0.0

    if min_pass_rate is not None and pass_rate < min_pass_rate:
        raise EvalDeskError(
            422,
            f"pass rate {pass_rate:.1%} is below the required {min_pass_rate:.1%}",
        )
    if max_failures is not None and run["failCount"] > max_failures:
        raise EvalDeskError(
            422,
            f"{run['failCount']} failures exceeds the allowed {max_failures}",
        )
