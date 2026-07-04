# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/

# UI/Design
- Use light theme (not dark) for marketing/landing pages. Confidence: 0.85
- Prioritize premium, polished UI - "jo dikhta hai vo bikta hai" (what looks good, sells). Confidence: 0.90
- Reference Y Combinator startup designs and sites like heizen.work, agentmail.to for inspiration. Confidence: 0.75
- Do NOT use AI-generated icons in the UI. Confidence: 0.75

# Development Workflow
- Do NOT push to GitHub until everything is fully tested and working. Confidence: 0.85
- Test thoroughly at each edge case before marking complete. Confidence: 0.80
- Use parallel agent execution (main agent delegating to multiple sub-agents) for faster delivery. Confidence: 0.75
- Execute decisions without asking permission — user expects autonomous action unless they specify otherwise. Confidence: 0.80

# Technical Preferences
- Prefer cost-effective APIs (DeepSeek) over expensive ones (Claude) when possible. Confidence: 0.80
- Build open-source products with monetization path (stars → enterprise). Confidence: 0.70
- Use Postgres for production databases — SQLite is only acceptable for local/dev self-host. Confidence: 0.85

# Quality Standards
- Everything must work perfectly - zero tolerance for broken features in shipped code. Confidence: 0.90
- User is building toward $10M company goal - treat projects as serious business ventures. Confidence: 0.75

# Communication Style
- Keep responses very concise — use minimal tokens to reduce cost. Confidence: 0.78
- Provide full, audited inventories of what's complete vs incomplete rather than piecemeal updates. Confidence: 0.70

# Business Development
- Research potential partners thoroughly (funding, team pedigree, product quality) before suggesting outreach. Confidence: 0.80
- Prefer creating small working integrations first, then demonstrate with PR + video. Confidence: 0.75
- Test own software thoroughly before pursuing external integrations. Confidence: 0.85
- Value concrete validation signals (valuation, team background, product quality) when evaluating partners. Confidence: 0.70

# Next.js
- For Next.js instrumentation.ts: use dynamic imports (`await import(...)`) to avoid webpack bundling native Node.js modules (like better-sqlite3) — webpack can't resolve 'fs' in browser context. Confidence: 0.65