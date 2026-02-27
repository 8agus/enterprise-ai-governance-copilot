# Version Control Log

## Repository
- Name: `enterprise-ai-governance-copilot`
- Branch: `main`

## Committed History (latest first)

| Commit | Scope | Summary |
|---|---|---|
| `0a680d0` | Ticket 6 | Configure dashboard API URL via env var (`NEXT_PUBLIC_API_URL`) and add env example support |
| `dc1aead` | Ticket 5 | Implement collapsible findings panel in dashboard |
| `3cbdbd9` | Ticket 4 | Persist mock audit findings and display in dashboard |
| `ddeb652` | Ticket 3 | Simulate audit run lifecycle (`pending` → `running` → `completed`) |
| `9379a47` | Infra | Enable CORS for local dashboard access |
| `ff0cc31` | Ticket 2 | Dashboard start-audit UI with direct API calls |
| `ce26f69` | Ticket 1 | Prisma service and `AuditRuns` API endpoints |
| `db72a2e` | Setup | Stabilize Prisma v6 with local PostgreSQL and `AuditRun` model |
| `bb1f6d2` | Cleanup | Normalize monorepo and remove nested git repos |
| `4d6c535` | Init | Initial Turborepo scaffold |

## Working Tree (not committed yet)

Current local changes detected:
- Modified: `apps/dashboard/app/page.tsx`
- Untracked: `apps/dashboard/lib/api.ts`

Planned scope for these local changes:
- Ticket 7: Introduce typed dashboard API client module and replace raw `fetch` calls in `page.tsx` while preserving existing UI/state behavior.

## Notes
- Keep this file updated when a ticket is completed and committed.
- Recommended update format per ticket:
  1. Ticket number and title
  2. Commit hash
  3. Files changed
  4. One-line outcome
