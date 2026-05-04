<div align="center">

# EvalDesk

**Test AI agents without writing code.**

[![Open Source](https://img.shields.io/badge/open%20source-MIT-green?style=flat-square)](https://github.com/ramandagar/EvalDesk/blob/main/LICENSE)
[![Self-Hostable](https://img.shields.io/badge/self--hostable-Docker-blue?style=flat-square)](https://github.com/ramandagar/EvalDesk/blob/main/docker-compose.yml)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square)](https://nextjs.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)](https://github.com/ramandagar/EvalDesk/pulls)

[Get Started](#quick-start) · [Features](#features) · [Use Cases](#use-cases) · [How It Works](#how-it-works) · [Tech Stack](#tech-stack)

</div>

---

Open-source evaluation tool that lets domain experts — doctors, lawyers, teachers, compliance officers — test and rate AI agent answers. No JSON. No Python scripts. No engineering required.

**Why EvalDesk?**

Current AI evaluation tools require engineers to write code. No-code alternatives charge $500+/month and lock you in. EvalDesk is the only tool that is open source + self-hostable + no-code.

---

## Quick Start

```bash
git clone https://github.com/ramandagar/EvalDesk.git
cd EvalDesk
docker compose up -d
```

Open http://localhost:3000 — that's it. No cloud dependency. Your data stays on your server.

## Features

- **Plain English test cases** — Write questions and expected answers in normal text
- **One-click agent testing** — Paste your agent URL, hit Run
- **Human rating interface** — Pass / Fail / Partial with keyboard shortcuts (1 / 2 / 3)
- **Quality dashboard** — Track pass rate over time, spot regressions
- **LLM-as-Judge** — Optional auto-scoring with GPT-4 or any LLM
- **Team collaboration** — Invite domain experts by email, no GitHub account needed
- **Self-hostable** — One Docker command, your infrastructure, your data
- **CI/CD integration** — GitHub Action included, fail PRs below your quality threshold

## Use Cases

| Who | What they test |
|-----|---------------|
| Doctors | Medical triage bots, diagnostic assistants |
| Lawyers | Contract review agents, legal research tools |
| Teachers | Educational AI tutors, grading assistants |
| Compliance | Banking chatbots, insurance claim processors |
| Product Managers | Customer support bots, FAQ agents |
| QA Teams | Regression testing for AI agent updates |

## How It Works

```
1. Create a project     → Name it, paste your agent's endpoint URL
2. Write test questions → Type what you'd ask the AI in plain English
3. Run & rate           → Each answer gets Pass/Fail/Partial with keyboard shortcuts
4. Track quality        → See pass rate trends, catch regressions before production
```

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 15, React 19, Tailwind CSS |
| Backend | Next.js API routes, Drizzle ORM |
| Database | SQLite (self-hosted), Postgres (cloud) |
| Auth | NextAuth.js |
| Deploy | Docker, docker-compose |
| CI/CD | GitHub Actions |

## Development

```bash
npm install
cp .env.example .env.local
npx drizzle-kit generate && npx drizzle-kit migrate
npm run dev
```

## Comparison

| Feature | EvalDesk | DeepEval | Langfuse | Confident AI |
|---------|----------|----------|----------|--------------|
| Open source | Yes | Yes | Yes | No |
| Self-hostable | Yes | Partial | Yes | No |
| No-code UI | Yes | No | Partial | Yes |
| Price | Free | Free | Free | $500+/mo |

## Contributing

PRs welcome. Fork, branch, open a pull request.

## License

MIT — use it, fork it, modify it, self-host it. No strings attached.

---

Built for the people who actually know if an AI answer is correct.
