# Boot Sequence

## Project Context

**Alethia** — an AI-powered regulatory intelligence platform that democratizes business intelligence for small businesses and startups. Built at HackIllinois 2026, competing across multiple tracks (Best Voyager Hack, Modal AI Inference, Best UI/UX, Best Social Impact, Supermemory, Solana).

## Load Order

Read these documents in order before starting any work:

1. `identity.md` — What Alethia is and the problem it solves
2. `soul.md` — How to think, decide, and design
3. `tools.md` — Tech stack, project structure, and commands
4. `user.md` — Who you're working with
5. `heartbeat.md` — Current project state
6. `active-tasks.md` — What needs doing
7. `learnings.md` — What we've learned so far

## Environment Setup

Before writing any code, verify:

- [ ] Python virtual environment is active (`source venv/bin/activate`)
- [ ] Node modules installed (`npm install` in frontend/)
- [ ] Modal token configured (`modal token new`)
- [ ] FastAPI dev server can start (`uvicorn main:app --reload`)
- [ ] React dev server can start (`npm run dev` in frontend/)

## Pre-Flight Checks

- Run `git status` to understand current branch and working state
- Check `active-tasks.md` for current priorities
- Check `heartbeat.md` for known blockers
- Check `learnings.md` before solving a problem — it may already be solved

## Rules

- Always read the relevant source files before modifying them
- Commit after each completed task
- Update `heartbeat.md` when project status changes
- Update `learnings.md` when you discover something reusable
- Update `active-tasks.md` when tasks change status
- Always include "This is not legal advice" disclaimers in user-facing regulatory content
- Design every UI element with the Best UI/UX track in mind
