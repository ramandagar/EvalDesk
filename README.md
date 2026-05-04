# EvalDesk

**Test AI agents without writing code.**

EvalDesk is an open-source, self-hostable evaluation tool that lets domain experts — doctors, lawyers, teachers, compliance officers — test and rate AI agent answers. No JSON. No Python scripts. No engineering required.

## Why EvalDesk?

Current AI evaluation tools (DeepEval, Langfuse, MLflow) require engineers to write code. No-code alternatives (Confident AI, Maxim AI) charge $500+/month and are closed source.

**EvalDesk fills the gap**: open source + self-hostable + no-code UI. This combination doesn't exist anywhere else.

## Quick Start

```bash
# Clone and run
git clone https://github.com/your-username/evaldesk.git
cd evaldesk
docker compose up -d

# Open in browser
open http://localhost:3000
```

That's it. No cloud dependency. Your data stays on your server.

## Features

- **Plain English test cases** — Write questions and expected answers in normal text
- **One-click agent testing** — Paste your agent URL, hit Run
- **Human rating interface** — Pass/Fail/Partial with keyboard shortcuts (1/2/3)
- **Quality dashboard** — Track pass rate over time, spot regressions
- **LLM-as-Judge** — Optional auto-scoring with GPT-4 or any LLM
- **Team collaboration** — Invite domain experts by email, no GitHub account needed
- **Self-hostable** — One Docker command, your infrastructure, your data

## Tech Stack

- **Frontend**: Next.js 15, React 19, Tailwind CSS, Framer Motion
- **Backend**: Next.js API routes, Drizzle ORM
- **Database**: SQLite (dev/self-hosted), Postgres (cloud)
- **Auth**: NextAuth.js
- **Deploy**: Docker, docker-compose

## Development

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local

# Run database migrations
npx drizzle-kit generate
npx drizzle-kit migrate

# Start dev server
npm run dev
```

## Use Cases

| Who | What they test |
|-----|---------------|
| Doctors | Medical triage bots, diagnostic assistants |
| Lawyers | Contract review agents, legal research tools |
| Teachers | Educational AI tutors, grading assistants |
| Compliance | Banking chatbots, insurance claim processors |
| Product Managers | Customer support bots, FAQ agents |

## How It Works

1. **Create a project** — Name it, paste your agent's endpoint URL
2. **Write test questions** — Type what you'd ask the AI in plain English
3. **Run & rate** — Each answer gets Pass/Fail/Partial buttons with keyboard shortcuts
4. **Track quality** — See pass rate trends, catch regressions before production

## License

MIT — use it, fork it, modify it, self-host it. No strings attached.

---

Built for the people who actually know if an AI answer is correct.
