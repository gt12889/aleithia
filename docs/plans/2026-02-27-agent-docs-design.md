# Agent Configuration Documents Design

**Date:** 2026-02-27
**Project:** Not Palantir (HackIllinois 2026)
**Purpose:** Claude Code project-specific configuration documents

## Context

"Not Palantir" is a data analysis platform built at HackIllinois 2026. Tech stack: Python (FastAPI) backend + React frontend, with pandas/polars for data processing.

These 8 markdown documents configure Claude Code's behavior when working on this project. They live in `docs/agent/` as a flat directory structure.

## Document Specifications

### boot.md — Startup Instructions
Entry point Claude Code reads first.
- Load order for other docs
- Environment setup expectations (Python venv, Node for React)
- Pre-flight checks before starting work
- References to all other agent docs

### identity.md — Project Identity
- Project name, mission, team context
- HackIllinois 2026 hackathon constraints
- Project boundaries (what it IS and ISN'T)

### soul.md — Coding Philosophy & Values
- Hackathon mindset: ship fast, iterate, pragmatic over perfect
- Code style: PEP 8 + type hints (Python), functional components + hooks (React)
- Decision principles: simple over clever, MVP first
- Error handling and communication tone

### heartbeat.md — Project Status
Living document tracking:
- Overall project health/phase
- What's working, what's broken
- Current blockers
- Last updated timestamp

### tools.md — Tech Stack & Tooling
- Backend: Python 3.x, FastAPI, pandas/polars
- Frontend: React (Vite or Next.js)
- Dev tools: pytest, ESLint, Prettier
- Key CLI commands
- Database and deployment info

### user.md — User Profile & Preferences
- Team members and roles
- Workflow and communication preferences
- Skill levels for calibrated assistance

### active-tasks.md — Task Tracking
- Prioritized task list with status
- Dependencies between tasks
- Next up queue

### learnings.md — Accumulated Insights
- Bugs encountered and fixes
- Architectural decisions and rationale
- Patterns and anti-patterns discovered

## Structure

```
docs/agent/
├── boot.md
├── identity.md
├── soul.md
├── heartbeat.md
├── tools.md
├── user.md
├── active-tasks.md
└── learnings.md
```

## Decision Rationale

- **Flat directory** over nested: simplicity wins for a hackathon
- **Separate files** over monolith: easier to update individual sections
- **boot.md as entry point**: establishes load order and context
