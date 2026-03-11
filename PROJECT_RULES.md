# Enterprise AI Governance Copilot — Architecture Guardrails

This file defines the mandatory implementation rules for Copilot and all AI-assisted coding in this repository.

The goal is to preserve architectural consistency, prevent uncontrolled refactoring, and keep work aligned to ticket scope.

---

## 1. General Rule

When implementing a ticket:

- change only the files explicitly allowed by the ticket
- do not refactor unrelated code
- do not rename files, variables, functions, or folders unless the ticket explicitly requires it
- do not introduce new dependencies unless the ticket explicitly requires it
- do not change working behavior outside the scope of the ticket
- preserve existing functionality at all times

If something appears incorrect but is outside ticket scope, note it in the handover summary instead of changing it.

---

## 2. Monorepo Structure

This repository uses a Turborepo monorepo structure.

Expected app boundaries:

- `apps/api` = NestJS backend
- `apps/dashboard` = Next.js frontend
- shared logic should not be moved unless explicitly requested
- do not blur boundaries between frontend and backend

Rules:

- frontend code must stay in `apps/dashboard`
- backend code must stay in `apps/api`
- do not place backend logic inside the dashboard
- do not place UI logic inside the API
- do not duplicate business logic across layers unless explicitly required for the MVP

---

## 3. Backend Rules (NestJS)

For `apps/api`:

- use NestJS patterns consistently
- business logic belongs in services
- controllers should stay thin
- persistence logic should remain cleanly separated from controller logic
- Prisma access should follow existing service patterns
- do not introduce unnecessary abstraction for small MVP tickets
- prefer simple service methods over over-engineered patterns

Rules:

- controller = request/response handling only
- service = business logic
- Prisma/database interaction = existing project pattern
- no silent schema changes without explicit ticket scope
- no broad refactors of module structure unless explicitly requested

---

## 4. Frontend Rules (Next.js)

For `apps/dashboard`:

- keep the current page behavior stable
- prefer minimal, scoped edits
- do not refactor page structure unless explicitly requested
- keep state changes local when possible
- do not create new components unless the ticket clearly benefits from it
- do not move logic into new files unless explicitly requested

Rules:

- keep UI changes small and readable
- preserve existing interaction flow
- preserve error handling already implemented
- preserve loading behavior already implemented
- preserve current TypeScript strictness

---

## 5. TypeScript Rules

This project uses strict TypeScript.

Rules:

- no `any` unless absolutely unavoidable
- prefer explicit types where helpful
- preserve existing type contracts
- do not weaken types just to remove errors
- do not bypass errors with unsafe casting unless there is no reasonable alternative
- keep types aligned with actual backend responses

If a type mismatch is discovered:
- fix it in the smallest correct way
- do not perform unrelated type cleanup

---

## 6. Ticket Scope Enforcement

For every ticket, Copilot must treat the ticket as a strict implementation boundary.

Before making changes, validate:

1. Which files are allowed to change?
2. What behavior must remain unchanged?
3. Are backend changes allowed?
4. Are refactors allowed?
5. Are new files allowed?

If the answer is "no" or "not specified", do not do it.

---

## 7. Required Implementation Style

Copilot should act like a disciplined junior engineer working under senior architectural supervision.

That means:

- implement only what was requested
- prefer the smallest safe change
- avoid speculative improvements
- avoid cleanup unrelated to the ticket
- avoid “while I’m here” edits
- keep diffs small
- preserve working code

---

## 8. Required Handover Format After Each Ticket

After completing a ticket, always provide the summary inside a single Markdown code block using this exact structure:

```text
Ticket: <number> — <title>

Goal
<brief explanation of what was implemented>

Diff Summary
- <change 1>
- <change 2>

Modified Files
- <file path>

Validation
- <command>
- <result>

Scope Check
- Only allowed files modified: Yes/No
- Refactors introduced: Yes/No
- Backend changed: Yes/No
- Unrelated changes made: Yes/No