# EvalDesk REST API Reference

EvalDesk exposes a RESTful API for programmatically managing projects, test cases, evaluation runs, human review queues, and cryptographically signed compliance certificates.

## Base URL

- **Production:** `https://evaldesk.dev/api/v1`
- **Self-Hosted:** `http://localhost:3000/api/v1`

---

## Authentication

All API endpoints (except `/api/health`, `/api/demo`, and public certificate viewers) require authentication.

### 1. API Keys (Machine / CI / SDK)
Pass your API key in the `Authorization` header:
```http
Authorization: Bearer evaldesk_live_xxxxxxxxxxxxxxxxxxxxxxxx
```
You can generate API keys under **Dashboard → API Keys** or via `POST /api/v1/api-keys`.

### 2. Session Cookie (Browser Dashboard)
Browser requests use the secure, HTTP-only `evaldesk_session` cookie issued upon calling `POST /api/auth/login`.

---

## Health & Public Endpoints

### Check Health Probe
```http
GET /api/health
```
**Response (200 OK):**
```json
{
  "status": "ok",
  "version": "0.1.0",
  "database": "connected",
  "timestamp": 1744368000000
}
```

### Public Demo Run & Certificate
```http
GET /api/demo
```
Returns sample evaluation metrics, HIPAA compliance coverage matrix, and offline-verifiable Ed25519 signature hash.

---

## Projects

### List Projects
```http
GET /api/v1/projects
```
**Response (200 OK):**
```json
{
  "projects": [
    {
      "id": "proj_medtriage_prod",
      "name": "MedTriage AI Assistant",
      "description": "Clinical triage dialogue agent with HIPAA compliance constraints",
      "agentUrl": "https://api.medtriage.internal/v1/chat",
      "targetModel": "claude-sonnet-5-5",
      "judgeModel": "claude-opus-5",
      "passThreshold": 80,
      "createdAt": 1744368000000
    }
  ]
}
```

### Create Project
```http
POST /api/v1/projects
Content-Type: application/json

{
  "name": "Financial Advisory Bot",
  "description": "Portfolio balancing recommendations",
  "agentUrl": "https://api.fintech.internal/chat",
  "targetModel": "claude-sonnet-5-5",
  "judgeModel": "gpt-4o",
  "passThreshold": 85
}
```

---

## Test Cases

### List Test Cases
```http
GET /api/v1/test-cases?projectId=proj_medtriage_prod
```

### Create Test Case
```http
POST /api/v1/test-cases
Content-Type: application/json

{
  "projectId": "proj_medtriage_prod",
  "input": "Patient has acute chest pain radiating to left shoulder. What is your diagnosis?",
  "expectedOutput": "Immediate referral to emergency medical services (911) with escalation protocols.",
  "context": "Clinical guideline protocol Section 4.2.1: Acute Coronary Syndrome triage procedures.",
  "category": "hipaa_164_312_emergency_access"
}
```

> **Note:** Adding `context` activates the **RAG Faithfulness Scorer**, checking whether factual claims in the response are grounded in the reference text.

### Batch Import Test Cases
```http
POST /api/v1/imports
Content-Type: application/json

{
  "projectId": "proj_medtriage_prod",
  "format": "deepeval",
  "data": [ ... ]
}
```
*Supported formats:* `"deepeval"`, `"langfuse"`, `"openai-evals"`, `"json"`, `"csv"`.

---

## Evaluation Runs

### Trigger an Evaluation Run
```http
POST /api/v1/runs
Content-Type: application/json

{
  "projectId": "proj_medtriage_prod",
  "name": "CI Nightly: HIPAA Audit Suite",
  "trigger": "ci"
}
```
**Response (202 Accepted):**
```json
{
  "id": "run_01j4k9m3n8p2",
  "status": "queued",
  "totalCases": 50,
  "createdAt": 1744368500000
}
```

### Get Run Status & Summary
```http
GET /api/v1/runs/:id
```
**Response (200 OK):**
```json
{
  "id": "run_01j4k9m3n8p2",
  "projectId": "proj_medtriage_prod",
  "status": "completed",
  "totalCases": 50,
  "passCount": 48,
  "failCount": 1,
  "partialCount": 1,
  "unratedCount": 0,
  "passRate": 0.96,
  "avgLatencyMs": 412,
  "estimatedCostUsd": 0.042,
  "certificateHash": "3f8b9a2c...ed25519"
}
```

### Get Run Results (Per-Case Breakdown)
```http
GET /api/v1/runs/:id/results
```

### Get Compliance Coverage Matrix
```http
GET /api/v1/runs/:id/coverage
```
Returns mapped compliance framework results (e.g., HIPAA Security Rule 164.312, EU AI Act Article 14) showing mandatory controls covered, passed, and failed.

---

## Cryptographic Certificates & Human Sign-Off

### Get Ed25519 Certificate
```http
GET /api/v1/runs/:id/certificate
```
**Response (200 OK):**
```json
{
  "certificate": {
    "version": "1.0",
    "runId": "run_01j4k9m3n8p2",
    "projectId": "proj_medtriage_prod",
    "organization": "MedTriage Health",
    "passRate": 0.96,
    "evaluatedAt": 1744369000000,
    "judgeModels": ["claude-sonnet-5-5", "claude-opus-5", "gpt-4o"],
    "signerPublicKey": "ed25519:a1b2c3d4...",
    "signature": "7f8e9d0a...hex"
  }
}
```

Certificates can be verified offline using the EvalDesk CLI:
```bash
npx evaldesk verify --cert certificate.json --key pubkey.pem
```

### Sign-Off on Run
```http
POST /api/v1/runs/:id/signoff
Content-Type: application/json

{
  "decision": "approved",
  "notes": "Reviewed and validated compliance coverage. Ready for production release."
}
```

---

## Webhooks

EvalDesk delivers real-time notifications for completed runs, failed thresholds, and review queue updates.

### Register Webhook
```http
POST /api/v1/webhooks
Content-Type: application/json

{
  "url": "https://api.yourdomain.com/webhooks/evaldesk",
  "events": ["run.completed", "run.threshold_failed", "review.required"],
  "secret": "whsec_supersecretkey"
}
```

Payloads include an `X-EvalDesk-Signature` header calculated using HMAC-SHA256.
