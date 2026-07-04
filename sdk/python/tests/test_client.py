import pytest
from unittest.mock import patch, MagicMock

from evaldesk import EvalDesk, assert_run_passes, EvalDeskError
from evaldesk.types import Run


@pytest.fixture
def client():
    return EvalDesk("https://evaldesk.example.com", "test-token", "org-123")


# ── Header wiring ─────────────────────────────────────────────────────────────

def test_client_sets_correct_headers(client):
    assert client._session.headers["x-org-id"] == "org-123"
    assert "evaldesk_session=test-token" in client._session.headers["cookie"]


# ── Projects ──────────────────────────────────────────────────────────────────

def test_projects_list(client):
    mock_resp = MagicMock()
    mock_resp.ok = True
    mock_resp.json.return_value = {"projects": [{"id": "p1", "name": "Triage"}]}
    with patch.object(client._session, "get", return_value=mock_resp):
        result = client.projects.list()
    assert len(result) == 1
    assert result[0]["name"] == "Triage"


def test_projects_get(client):
    mock_resp = MagicMock()
    mock_resp.ok = True
    mock_resp.json.return_value = {"project": {"id": "p1", "name": "Triage"}}
    with patch.object(client._session, "get", return_value=mock_resp):
        project = client.projects.get("p1")
    assert project["id"] == "p1"


def test_projects_create(client):
    mock_resp = MagicMock()
    mock_resp.ok = True
    mock_resp.json.return_value = {"project": {"id": "p2", "name": "New"}}
    with patch.object(client._session, "post", return_value=mock_resp) as mock_post:
        project = client.projects.create("New", agent_endpoint="https://agent.test/v1")
    assert project["id"] == "p2"
    posted_body = mock_post.call_args.kwargs["json"]
    assert posted_body["name"] == "New"
    assert posted_body["agentEndpoint"] == "https://agent.test/v1"


# ── Test cases ────────────────────────────────────────────────────────────────

def test_test_cases_list(client):
    mock_resp = MagicMock()
    mock_resp.ok = True
    mock_resp.json.return_value = {"testCases": [{"id": "tc1", "title": "Q1"}]}
    with patch.object(client._session, "get", return_value=mock_resp) as mock_get:
        result = client.test_cases.list("p1")
    assert len(result) == 1
    assert "projectId=p1" in mock_get.call_args.args[0]


def test_test_cases_create_with_context(client):
    mock_resp = MagicMock()
    mock_resp.ok = True
    mock_resp.json.return_value = {"testCase": {"id": "tc2", "title": "RAG Q"}}
    with patch.object(client._session, "post", return_value=mock_resp) as mock_post:
        tc = client.test_cases.create(
            "p1", "RAG Q", "What revenue?",
            expected_output="15%", context="Revenue was 15% YoY."
        )
    assert tc["id"] == "tc2"
    body = mock_post.call_args.kwargs["json"]
    assert body["context"] == "Revenue was 15% YoY."


def test_test_cases_generate_probes(client):
    mock_resp = MagicMock()
    mock_resp.ok = True
    mock_resp.json.return_value = {"queued": True, "type": "jailbreak", "count": 5}
    with patch.object(client._session, "post", return_value=mock_resp) as mock_post:
        result = client.test_cases.generate_probes("p1", probe_type="jailbreak", count=5)
    assert result["queued"] is True
    assert "/projects/p1/probes" in mock_post.call_args.args[0]


def test_test_cases_import_dataset(client):
    mock_resp = MagicMock()
    mock_resp.ok = True
    mock_resp.json.return_value = {"result": {"imported": 3}}
    with patch.object(client._session, "post", return_value=mock_resp):
        result = client.test_cases.import_dataset("p1", '{"goldens":[]}')
    assert result["imported"] == 3


# ── Runs ──────────────────────────────────────────────────────────────────────

def test_runs_create(client):
    mock_resp = MagicMock()
    mock_resp.ok = True
    mock_resp.json.return_value = {"run": {"id": "r1", "status": "queued"}}
    with patch.object(client._session, "post", return_value=mock_resp):
        run = client.runs.create("p1")
    assert run["status"] == "queued"


def test_runs_get(client):
    mock_resp = MagicMock()
    mock_resp.ok = True
    mock_resp.json.return_value = {"run": {"id": "r1", "status": "completed", "passCount": 9}}
    with patch.object(client._session, "get", return_value=mock_resp):
        run = client.runs.get("r1")
    assert run["passCount"] == 9


def test_runs_list_with_project_id(client):
    mock_resp = MagicMock()
    mock_resp.ok = True
    mock_resp.json.return_value = {"runs": [{"id": "r1"}, {"id": "r2"}]}
    with patch.object(client._session, "get", return_value=mock_resp) as mock_get:
        runs = client.runs.list(project_id="p1")
    assert len(runs) == 2
    assert "projectId=p1" in mock_get.call_args.args[0]


def test_runs_signoff(client):
    mock_resp = MagicMock()
    mock_resp.ok = True
    mock_resp.json.return_value = {"ok": True}
    with patch.object(client._session, "post", return_value=mock_resp) as mock_post:
        client.runs.signoff("r1", decision="approve")
    body = mock_post.call_args.kwargs["json"]
    assert body["decision"] == "approve"


def test_runs_coverage(client):
    mock_resp = MagicMock()
    mock_resp.ok = True
    mock_resp.json.return_value = {"suiteId": "hipaa", "controlsCovered": 3}
    with patch.object(client._session, "get", return_value=mock_resp) as mock_get:
        result = client.runs.coverage("r1", suite="hipaa")
    assert "suite=hipaa" in mock_get.call_args.args[0]


def test_runs_wait_returns_immediately_on_terminal_status(client):
    mock_resp = MagicMock()
    mock_resp.ok = True
    mock_resp.json.return_value = {"run": {"id": "r1", "status": "completed", "passCount": 5,
                                           "failCount": 0, "partialCount": 0}}
    with patch.object(client._session, "get", return_value=mock_resp):
        run = client.runs.wait("r1", poll_interval=0)
    assert run["status"] == "completed"


def test_runs_wait_polls_until_terminal(client):
    responses = [
        {"run": {"id": "r1", "status": "running"}},
        {"run": {"id": "r1", "status": "running"}},
        {"run": {"id": "r1", "status": "completed", "passCount": 3,
                 "failCount": 0, "partialCount": 0}},
    ]
    side_effects = []
    for resp in responses:
        m = MagicMock()
        m.ok = True
        m.json.return_value = resp
        side_effects.append(m)

    with patch.object(client._session, "get", side_effect=side_effects):
        with patch("time.sleep"):  # don't actually wait
            run = client.runs.wait("r1", poll_interval=0.01)
    assert run["status"] == "completed"


def test_runs_wait_raises_on_timeout(client):
    mock_resp = MagicMock()
    mock_resp.ok = True
    mock_resp.json.return_value = {"run": {"id": "r1", "status": "running"}}
    with patch.object(client._session, "get", return_value=mock_resp):
        with patch("time.sleep"):
            with pytest.raises(EvalDeskError) as exc:
                client.runs.wait("r1", timeout=0, poll_interval=0.01)
    assert exc.value.status == 408


# ── Certificates ──────────────────────────────────────────────────────────────

def test_get_certificate(client):
    mock_resp = MagicMock()
    mock_resp.ok = True
    mock_resp.json.return_value = {"certificate": {"id": "cert1", "signature": "abc123"}}
    with patch.object(client._session, "get", return_value=mock_resp):
        cert = client.get_certificate("r1")
    assert cert["id"] == "cert1"


# ── Error handling ────────────────────────────────────────────────────────────

def test_error_handling_404(client):
    mock_resp = MagicMock()
    mock_resp.ok = False
    mock_resp.status_code = 404
    mock_resp.json.return_value = {"error": "Not found"}
    with patch.object(client._session, "get", return_value=mock_resp):
        with pytest.raises(EvalDeskError) as exc:
            client.runs.get("nonexistent")
    assert exc.value.status == 404
    assert "Not found" in str(exc.value)


def test_error_handling_401(client):
    mock_resp = MagicMock()
    mock_resp.ok = False
    mock_resp.status_code = 401
    mock_resp.json.return_value = {"error": "Unauthorized"}
    with patch.object(client._session, "get", return_value=mock_resp):
        with pytest.raises(EvalDeskError) as exc:
            client.me()
    assert exc.value.status == 401


# ── assert_run_passes ─────────────────────────────────────────────────────────

def test_assert_run_passes_ok():
    run: Run = {"id": "r1", "projectId": "p1", "status": "completed",
                "totalCases": 10, "passCount": 8, "failCount": 1,
                "partialCount": 1, "unratedCount": 0, "passRate": 80}
    assert_run_passes(run, min_pass_rate=0.7)   # 80% >= 70% → OK


def test_assert_run_passes_below_pass_rate():
    run: Run = {"id": "r1", "projectId": "p1", "status": "completed",
                "totalCases": 10, "passCount": 5, "failCount": 5,
                "partialCount": 0, "unratedCount": 0, "passRate": 50}
    with pytest.raises(EvalDeskError, match="pass rate"):
        assert_run_passes(run, min_pass_rate=0.8)


def test_assert_run_passes_too_many_failures():
    run: Run = {"id": "r1", "projectId": "p1", "status": "completed",
                "totalCases": 10, "passCount": 7, "failCount": 3,
                "partialCount": 0, "unratedCount": 0, "passRate": 70}
    with pytest.raises(EvalDeskError, match="failures"):
        assert_run_passes(run, max_failures=2)


def test_assert_run_passes_zero_decided():
    """All results unrated → pass_rate=0, should still not raise if no gate set."""
    run: Run = {"id": "r1", "projectId": "p1", "status": "completed",
                "totalCases": 5, "passCount": 0, "failCount": 0,
                "partialCount": 0, "unratedCount": 5, "passRate": None}
    assert_run_passes(run)   # no constraints → should not raise


def test_assert_run_passes_both_gates_enforced():
    run: Run = {"id": "r1", "projectId": "p1", "status": "completed",
                "totalCases": 10, "passCount": 6, "failCount": 4,
                "partialCount": 0, "unratedCount": 0, "passRate": 60}
    # Fails BOTH gates — min_pass_rate is checked first
    with pytest.raises(EvalDeskError, match="pass rate"):
        assert_run_passes(run, min_pass_rate=0.9, max_failures=1)
