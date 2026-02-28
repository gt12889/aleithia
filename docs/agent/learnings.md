# Learnings

## Architecture Decisions

| Decision | Rationale | Date |
|----------|-----------|------|
| FastAPI + React | Fast to build, good DX, strong ecosystem | 2026-02-27 |
| Monolith over microservices | 36-hour hackathon — simplicity wins | 2026-02-28 |
| Modal as ENTIRE compute backbone | Pipelines + inference on one platform = genuinely ambitious for judges | 2026-02-28 |
| Llama 3.1 8B over 70B | Fits A10G, fast inference, $250 credits last longer | 2026-02-28 |
| OpenAI for chat generation | Best quality, separates concerns from Modal inference. $5K credits/member | 2026-02-28 |
| Live data over pre-curated | More ambitious demo, real-time relevance, stronger Modal submission | 2026-02-28 |
| Chicago focus | Local to HackIllinois, tangible demo, rich public APIs (Socrata, Legistar) | 2026-02-28 |
| Supermemory for context | Sponsor track — all 5 APIs: Profiles, Memory, Retrieval, Connectors, Multi-modal | 2026-02-27 |
| Cloudflare Pages for frontend | Sponsor track ($5K credits/member) + trivial deploy | 2026-02-28 |
| Solana deferred as stretch goal | Blockchain verification of data provenance — pursue if time permits | 2026-02-28 |
| Chat + Dashboard hybrid UX | Best of both worlds for UI/UX judges — interactive + visual | 2026-02-28 |
| Tailwind CSS | Rapid UI development, consistent design system | 2026-02-27 |
| Name: Alethia | Greek "unconcealment" — truth revealed, not constructed | 2026-02-27 |

## Judging Strategy

### What Wins Each Track

| Track | What Judges Want | How Alethia Delivers |
|-------|-----------------|---------------------|
| Best Voyager Hack ($5K) | Creativity, technical complexity, impact, execution | Live data pipelines + dual-model inference + social mission |
| Modal AI Inference | Ambitious inference on Modal solving real-world problem | ENTIRE compute backbone: 7 cron pipelines + Llama 3.1 8B + embeddings — not just API wrapping |
| Best UI/UX (Camera) | Intuitive, polished, delightful. Visual hierarchy, accessibility, seamless interaction | Chat + Dashboard hybrid with Chicago map, risk cards, streaming |
| Best Social Impact (Speakers) | Tangible positive change addressing pressing societal issue | Directly addresses regulatory inequity for small businesses |
| Supermemory (RayBans) | App that remembers, understands, adapts. Use multiple APIs | All 5 APIs: Profiles + Memory + Retrieval + Connectors + Multi-modal |
| OpenAI ($5K credits) | Use OpenAI API | Chat generation from RAG context |
| Cloudflare ($5K credits) | Use Cloudflare developer platform | Frontend on Cloudflare Pages |
| Solana (stretch) | Use Solana blockchain | Verification of regulatory data provenance — stretch goal |
| .Tech Domain (mic) | Register .tech domain | alethia.tech |

### Key Insight
The social impact narrative is our strongest differentiator. Every demo moment should reinforce: "Big companies have teams of lawyers and analysts. We give that same power to a coffee shop owner." The technical sophistication (Modal, Supermemory) serves this story.

### Demo Script Framework
1. Meet our user: small business owner opening a restaurant in **Lincoln Park, Chicago**
2. Onboard: enter business type + neighborhood → Supermemory stores profile
3. Show the regulatory complexity: permits, zoning, health dept, employment law
4. Live data: "Today's City Council discussed new restaurant zoning in your ward" (from Legistar pipeline)
5. Local Pulse: Reddit sentiment about the neighborhood, Yelp review trends, CTA foot traffic data
6. AI Analysis: Modal runs Llama 3.1 → risk score, action items, personalized recommendations
7. Chat: "What permits do I need?" → OpenAI generates response from RAG context → streams to chat
8. Come back later → Supermemory remembers everything → new recommendations based on latest data
9. Contrast: "A large firm has a team of lawyers and analysts for this. Now you have Alethia."

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
