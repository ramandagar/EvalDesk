<div align="center">

# EvalDesk

**Open-Source AI Agent Evaluation, Compliance Verification & Cryptographic Signing Platform**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Docker Ready](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker&logoColor=white)](https://github.com/ramandagar/EvalDesk/blob/main/docker-compose.yml)
[![Next.js 15](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![Multi-Model](https://img.shields.io/badge/Multi--Model%20Judges-Claude%20%7C%20GPT--4o%20%7C%20DeepSeek%20%7C%20Ollama-blueviolet?style=flat-square)](https://evaldesk.dev)
[![TypeScript SDK](https://img.shields.io/badge/TypeScript-SDK-3178C6?style=flat-square&logo=typescript)](https://github.com/ramandagar/EvalDesk)
[![Python SDK](https://img.shields.io/badge/Python-SDK-3776AB?style=flat-square&logo=python&logoColor=white)](docs/python-sdk.md)

[Live Demo](https://evaldesk.dev/demo) · [Quick Start](#quick-start) · [Architecture](ARCHITECTURE.md) · [REST API](API.md) · [Python SDK](docs/python-sdk.md) · [AWS Deployment](AWS_DEPLOY.md)

</div>

---

**EvalDesk** bridges the gap between AI engineering and domain compliance. It allows domain experts (doctors, attorneys, financial analysts, risk officers) and automated multi-model LLM ensembles (supporting **Anthropic Claude, OpenAI GPT-4o, DeepSeek, Google Gemini, and local Ollama models**) to rigorously evaluate, audit, and sign off on production AI agents.

Every evaluation produces an **Ed25519 cryptographically signed certificate** proving test coverage and pass rates for compliance standards like **HIPAA Security Rule (45 CFR § 164.312)** and the **EU AI Act**.

---

## Key Features

- **Multi-Model Ensemble Judge & Honest Confidence**: Combine multiple LLM judges (Claude, GPT-4o, DeepSeek) with mathematical agreement metrics (Cohen's / Fleiss' Kappa) and automatic routing of ambiguous cases to human experts.
- **RAG Faithfulness & Citation Verification**: Automatically verify that agent responses are grounded in provided reference documents to eliminate hallucinations.
- **Automated Red-Teaming & Safety Probes**: Generate adversarial prompt injections, jailbreaks, and PII/PHI leakage attacks against agent endpoints on demand.
- **Compliance Packs (HIPAA & EU AI Act)**: Pre-mapped test case categories that prove regulatory control coverage.
- **Offline-Verifiable Ed25519 Certificates**: Tamper-proof digital certificates signed with public-key cryptography that auditors can verify offline.
- **Python & TypeScript SDKs**: Trigger runs, poll status, and enforce CI/CD build failure gates (`assert_run_passes`) in automated pipelines.
- **GitHub Action**: Native PR gate that evaluates agent PRs and comments results directly on pull requests.
- **Self-Hostable & Privacy First**: Run locally with SQLite or scale in production with PostgreSQL and Docker.

---

## Architecture Overview

```
                                ┌─────────────────────────┐
                                │  Human Domain Reviewer  │
                                └────────────┬────────────┘
                                             │ (Flagged cases)
 ┌────────────────┐     ┌──────────────┐     ▼     ┌────────────────────────┐
 │ CI / SDK / Web ├────►│ EvalDesk API ├──────────►│ Ensemble LLM Judges    │
 └────────────────┘     └──────┬───────┘           │ Claude / GPT-4o/DeepSeek
                                │                   └───────────┬────────────┘
                               ▼                               ▼
                      ┌─────────────────┐             ┌─────────────────────┐
                      │ Postgres / SQLite│            │ Ed25519 Certificate │
                      └─────────────────┘             └─────────────────────┘
```

---

## Quick Start (Docker)

Deploy the entire stack (Next.js web app + PostgreSQL + background evaluation worker) with a single command:

```bash
git clone https://github.com/ramandagar/EvalDesk.git
cd EvalDesk
docker compose up -d
```

Open `http://localhost:3000` to access the dashboard.

---

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template
cp .env.example .env.local

# 3. Generate database migrations
npm run db:gen

# 4. Start development server
npm run dev

# 5. Run test suite (75+ unit & integration tests)
npm test
```

---

## SDKs & Integrations

### Python SDK
```python
from evaldesk import EvalDesk, assert_run_passes

client = EvalDesk(base_url="https://evaldesk.dev", token="evaldesk_live_key", org="org_id")
run = client.runs.create(project_id="proj_triage").wait()

# Fail CI/CD if pass rate is under 85%
assert_run_passes(run, min_pass_rate=0.85)
```
*See [docs/python-sdk.md](docs/python-sdk.md) for full Python documentation.*

### GitHub Action
Add an evaluation gate to your repository workflow:
```yaml
- name: EvalDesk Evaluation Gate
  uses: ./action
  with:
    base_url: https://evaldesk.dev
    token: ${{ secrets.EVALDESK_API_KEY }}
    org: ${{ secrets.EVALDESK_ORG_ID }}
    project_id: ${{ secrets.EVALDESK_PROJECT_ID }}
    min_pass_rate: "0.85"
```

---

## Security & Verification

EvalDesk generates verifiable Ed25519 cryptographic certificates for finalized runs:

```bash
# Verify certificate offline
npx evaldesk verify --cert certificate.json --key pubkey.pem
```

---

## License

This project is open-source under the [MIT License](LICENSE).
Built by Raman Dagar and community contributors.
