# EvalDesk Python SDK

The official Python client for EvalDesk (`evaldesk`). Integrate evaluation gates, run triggers, and compliance verification directly into Python-based AI agent pipelines and CI/CD test suites.

## Installation

```bash
pip install evaldesk
```

## Quick Start

```python
from evaldesk import EvalDesk, assert_run_passes

# Initialize the client
client = EvalDesk(
    base_url="https://evaldesk.dev",
    token="evaldesk_live_xxxxxxxxxxxxxxxxxxxxxxxx",
    org="org_medtriage_demo"
)

# Trigger an evaluation run
run_handle = client.runs.create(project_id="proj_clinical_agent")
print(f"Run created: {run_handle.id}. Waiting for completion...")

# Poll until completion
run = run_handle.wait(timeout_seconds=300, poll_interval_seconds=3)
print(f"Status: {run.status}, Pass Rate: {run.pass_rate * 100:.1f}%")

# Assert evaluation passes gate (raises EvalDeskError if below threshold)
assert_run_passes(run, min_pass_rate=0.85, max_failures=2)
print("✅ CI Evaluation Gate Passed!")
```

## Integrating into Pytest

```python
import pytest
from evaldesk import EvalDesk, assert_run_passes

@pytest.fixture
def evaldesk_client():
    return EvalDesk(
        base_url="https://evaldesk.dev",
        token="evaldesk_live_test_key",
        org="demo"
    )

def test_ai_agent_compliance(evaldesk_client):
    run = evaldesk_client.runs.create(project_id="proj_compliance").wait()
    assert_run_passes(run, min_pass_rate=0.90)
```

## Fetching Cryptographic Certificates

```python
cert = client.certificates.get(run_id="run_01j4k9m3n8p2")
print(f"Ed25519 Signature: {cert.signature}")
print(f"Signer Public Key: {cert.signer_public_key}")
```
