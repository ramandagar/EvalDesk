# PROMPT: Python SDK (your agent builds)

**Goal:** A standalone Python package `evaldesk` that wraps the REST API. Lives in `sdk/python/` inside the repo. No backend dependency — pure HTTP client.

## Package structure
```
sdk/python/
  pyproject.toml
  evaldesk/
    __init__.py          # exports EvalDesk, assert_run_passes
    client.py            # main client class
    exceptions.py        # EvalDeskError
    types.py             # TypedDicts for Run, Project, TestCase
  tests/
    test_client.py       # unit tests (mocked HTTP)
```

## pyproject.toml
```toml
[project]
name = "evaldesk"
version = "0.1.0"
description = "Python SDK for EvalDesk — AI-native, expert-verified evaluation"
requires-python = ">=3.9"
dependencies = ["requests>=2.28"]

[project.optional-dependencies]
dev = ["pytest", "pytest-cov"]
```

## evaldesk/exceptions.py
```python
class EvalDeskError(Exception):
    def __init__(self, status: int, message: str):
        self.status = status
        super().__init__(message)
```

## evaldesk/types.py
```python
from typing import TypedDict, Optional

class Project(TypedDict):
    id: str
    name: str
    agentEndpoint: Optional[str]
    hasAgentApiKey: bool

class Run(TypedDict):
    id: str
    projectId: str
    status: str           # queued | running | completed | failed | signed
    totalCases: int
    passCount: int
    failCount: int
    partialCount: int
    unratedCount: int
    passRate: Optional[int]

class TestCase(TypedDict):
    id: str
    projectId: str
    title: str
    input: str
    expectedOutput: Optional[str]
    context: Optional[str]
    category: Optional[str]
```

## evaldesk/client.py
```python
import time
from typing import Optional, List
import requests

from .exceptions import EvalDeskError
from .types import Project, Run, TestCase

TERMINAL_STATUSES = {"completed", "failed", "signed"}


class EvalDesk:
    """Client for the EvalDesk REST API."""

    def __init__(self, base_url: str, token: str, org: str):
        self.base_url = base_url.rstrip("/")
        self.org = org
        self._session = requests.Session()
        self._session.headers.update({
            "x-org-id": org,
            "cookie": f"evaldesk_session={token}",
            "content-type": "application/json",
        })

    def _get(self, path: str) -> dict:
        r = self._session.get(f"{self.base_url}/api/v1{path}")
        if not r.ok:
            raise EvalDeskError(r.status_code, r.json().get("error", f"HTTP {r.status_code}"))
        return r.json()

    def _post(self, path: str, body: dict | None = None) -> dict:
        r = self._session.post(f"{self.base_url}/api/v1{path}", json=body or {})
        if not r.ok:
            raise EvalDeskError(r.status_code, r.json().get("error", f"HTTP {r.status_code}"))
        return r.json()

    # ── Identity ──────────────────────────────────────────
    def me(self) -> dict:
        return self._get("/me")

    # ── Projects ──────────────────────────────────────────
    @property
    def projects(self):
        return _Projects(self)

    # ── Test cases ────────────────────────────────────────
    @property
    def test_cases(self):
        return _TestCases(self)

    # ── Runs ──────────────────────────────────────────────
    @property
    def runs(self):
        return _Runs(self)

    # ── Certificates ──────────────────────────────────────
    def get_certificate(self, run_id: str) -> dict:
        return self._get(f"/runs/{run_id}/certificate").get("certificate")


class _Projects:
    def __init__(self, client: EvalDesk):
        self._c = client

    def list(self) -> List[Project]:
        return self._c._get("/projects")["projects"]

    def create(self, name: str, agent_endpoint: str = None, agent_api_key: str = None,
               judge_base_url: str = None, judge_model: str = None, judge_api_key: str = None) -> Project:
        body = {"name": name}
        if agent_endpoint: body["agentEndpoint"] = agent_endpoint
        if agent_api_key: body["agentApiKey"] = agent_api_key
        if judge_base_url: body["judgeBaseUrl"] = judge_base_url
        if judge_model: body["judgeModel"] = judge_model
        if judge_api_key: body["judgeApiKey"] = judge_api_key
        return self._c._post("/projects", body)["project"]

    def get(self, project_id: str) -> Project:
        return self._c._get(f"/projects/{project_id}")["project"]


class _TestCases:
    def __init__(self, client: EvalDesk):
        self._c = client

    def create(self, project_id: str, title: str, input: str,
               expected_output: str = None, context: str = None, category: str = None) -> TestCase:
        body = {"projectId": project_id, "title": title, "input": input}
        if expected_output: body["expectedOutput"] = expected_output
        if context: body["context"] = context
        if category: body["category"] = category
        return self._c._post("/test-cases", body)["testCase"]

    def list(self, project_id: str) -> List[TestCase]:
        return self._c._get(f"/test-cases?projectId={project_id}")["testCases"]

    def import_dataset(self, project_id: str, data: str) -> dict:
        return self._c._post("/imports", {"projectId": project_id, "data": data})["result"]

    def generate_probes(self, project_id: str, probe_type: str = "jailbreak", count: int = 5) -> dict:
        return self._c._post(f"/projects/{project_id}/probes", {"type": probe_type, "count": count})


class _Runs:
    def __init__(self, client: EvalDesk):
        self._c = client

    def create(self, project_id: str) -> Run:
        return self._c._post("/runs", {"projectId": project_id})["run"]

    def get(self, run_id: str) -> Run:
        return self._c._get(f"/runs/{run_id}")["run"]

    def list(self, project_id: str = None) -> List[Run]:
        path = f"/runs?projectId={project_id}" if project_id else "/runs"
        return self._c._get(path)["runs"]

    def report(self, run_id: str) -> dict:
        return self._c._get(f"/runs/{run_id}/results")

    def coverage(self, run_id: str, suite: str = "hipaa") -> dict:
        return self._c._get(f"/runs/{run_id}/coverage?suite={suite}")

    def wait(self, run_id: str, timeout: int = 300, poll_interval: float = 2.5) -> Run:
        """Poll until the run reaches a terminal status, or raise on timeout."""
        start = time.monotonic()
        while True:
            run = self.get(run_id)
            if run["status"] in TERMINAL_STATUSES:
                return run
            if time.monotonic() - start > timeout:
                raise EvalDeskError(408, f"Run {run_id} did not finish within {timeout}s")
            time.sleep(poll_interval)

    def signoff(self, run_id: str, decision: str = "approve") -> dict:
        return self._c._post(f"/runs/{run_id}/signoff", {"decision": decision})


def assert_run_passes(run: Run, min_pass_rate: float = None, max_failures: int = None) -> None:
    """DeepEval-parity gate. Raises EvalDeskError if the run misses the bar."""
    decided = run["passCount"] + run["failCount"] + run["partialCount"]
    pass_rate = run["passCount"] / decided if decided > 0 else 0
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
```

## evaldesk/__init__.py
```python
from .client import EvalDesk, assert_run_passes
from .exceptions import EvalDeskError
from .types import Project, Run, TestCase

__all__ = ["EvalDesk", "assert_run_passes", "EvalDeskError", "Project", "Run", "TestCase"]
```

## tests/test_client.py
```python
import pytest
from unittest.mock import patch, MagicMock
from evaldesk import EvalDesk, assert_run_passes, EvalDeskError


@pytest.fixture
def client():
    return EvalDesk("https://evaldesk.example.com", "test-token", "org-123")


def test_projects_list(client):
    mock_response = MagicMock()
    mock_response.ok = True
    mock_response.json.return_value = {"projects": [{"id": "p1", "name": "Test"}]}
    with patch.object(client._session, "get", return_value=mock_response):
        result = client.projects.list()
        assert len(result) == 1
        assert result[0]["name"] == "Test"


def test_runs_create(client):
    mock_response = MagicMock()
    mock_response.ok = True
    mock_response.json.return_value = {"run": {"id": "r1", "status": "queued"}}
    with patch.object(client._session, "post", return_value=mock_response):
        run = client.runs.create("p1")
        assert run["status"] == "queued"


def test_assert_run_passes_ok():
    run = {"passCount": 8, "failCount": 1, "partialCount": 1}
    assert_run_passes(run, min_pass_rate=0.7)


def test_assert_run_passes_below_bar():
    run = {"passCount": 5, "failCount": 5, "partialCount": 0}
    with pytest.raises(EvalDeskError, match="pass rate"):
        assert_run_passes(run, min_pass_rate=0.8)


def test_assert_run_passes_too_many_failures():
    run = {"passCount": 7, "failCount": 3, "partialCount": 0}
    with pytest.raises(EvalDeskError, match="failures"):
        assert_run_passes(run, max_failures=2)


def test_error_handling(client):
    mock_response = MagicMock()
    mock_response.ok = False
    mock_response.status_code = 404
    mock_response.json.return_value = {"error": "Not found"}
    with patch.object(client._session, "get", return_value=mock_response):
        with pytest.raises(EvalDeskError) as exc:
            client.runs.get("nonexistent")
        assert exc.value.status == 404
```

## Verify
```bash
cd sdk/python && pip install -e ".[dev]" && pytest tests/ -v
```

## Constraints
- **Pure HTTP client** — no EvalDesk backend imports, no Next.js dependency.
- Auth = the `evaldesk_session` cookie (same as the TS SDK). Future: Bearer API key when the user has one.
- `run.wait()` polls `GET /runs/:id` every 2.5s until terminal — same pattern as the TS SDK.
- `assert_run_passes` mirrors the TS `assertRunPasses` — same gate logic.
- Covers ALL v1 endpoints: projects (create/list/get), test cases (create/list/import/probes), runs (create/get/list/report/coverage/wait/signoff), certificates.

Paste back the test output. I review, then we deploy + verify everything live.
