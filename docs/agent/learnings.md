# Learnings

## Architecture Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| FastAPI + React | Fast to build, good DX, strong ecosystem | 2026-02-27 |
| Modal for AI inference | Sponsor track — serverless GPU, no infra management, pay-per-use | 2026-02-27 |
| Supermemory for context | Sponsor track — persistent business-specific regulatory knowledge | 2026-02-27 |
| Solana for provenance | Sponsor track — verify regulatory data sources and timestamps | 2026-02-27 |
| pandas + polars | pandas for compatibility, polars for performance on large datasets | 2026-02-27 |
| Tailwind CSS | Rapid UI development, consistent design system for UI/UX track | 2026-02-27 |
| Flat agent docs | Simplicity over hierarchy for hackathon pace | 2026-02-27 |
| Name: Alethia | Greek "unconcealment" — truth revealed, not constructed. Fits regulatory transparency mission | 2026-02-27 |

## Judging Strategy

### What Wins Each Track

| Track | What Judges Want | How Alethia Delivers |
|-------|-----------------|---------------------|
| Best Voyager Hack | Creativity, technical complexity, impact, execution | Novel regulatory AI + multi-track integration + social mission |
| Modal AI Inference | Ambitious inference on Modal solving real-world problem | Run regulatory analysis models on Modal GPUs — not just API wrapping |
| Best UI/UX | Intuitive, polished, delightful. Visual hierarchy, accessibility, seamless interaction | Premium dashboard that makes complex data feel effortless |
| Best Social Impact | Tangible positive change addressing pressing societal issue | Directly addresses regulatory inequity for small businesses |
| Supermemory | App that remembers, understands, adapts. Use multiple APIs | Store business profiles, regulatory context, past queries — app gets smarter per user |

### Key Insight
The social impact narrative is our strongest differentiator. Every demo moment should reinforce: "Big companies have teams of lawyers and analysts. We give that same power to a coffee shop owner." The technical sophistication (Modal, Supermemory) serves this story.

### Demo Script Framework
1. Meet our user: small business owner opening a restaurant in Illinois
2. Show the regulatory complexity they face (the problem)
3. Alethia aggregates and analyzes (Modal AI inference — show it working)
4. Actionable recommendations appear (the solution)
5. Come back later — Supermemory remembers their context (it adapts)
6. Contrast: "A large firm has a team for this. Now you have Alethia."

## Domain Knowledge

### Regulatory Landscape
- Federal, state, and local regulations create a multi-layered compliance burden
- Key areas: employment law, environmental protection, consumer safety, taxation
- Regulations vary significantly by jurisdiction — location-aware analysis is critical
- Political landscape shifts can change regulatory requirements rapidly

### Target User
- Small business owners and startup founders
- Non-technical — UI must be approachable and jargon-free
- Time-poor — need actionable insights, not raw data
- Cannot afford legal teams or compliance analysts

## Bugs & Fixes

_None yet — document bugs and their solutions here as they arise._

## Patterns

_Document useful patterns discovered during development._

## Anti-Patterns

_Document things that didn't work so we don't repeat them._
