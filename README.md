# Enterprise AI Governance Copilot

A full-stack AI governance platform prototype for tracking AI use cases, governance reviews, risks, policies, and audit activity — built with TypeScript, NestJS, Next.js, and PostgreSQL.

## Overview

Organisations adopting AI need structured tooling to track governance reviews, manage policy compliance, monitor risks, and maintain an audit trail across their AI systems and repositories.

Enterprise AI Governance Copilot is a full-stack prototype addressing that need. It provides:

- A GitHub repository audit pipeline that scans for **security**, **privacy**, and **responsible-AI** policy gaps
- A **governance scoring engine** that calculates a 0–100 score and risk level per audit run
- A **PostgreSQL-backed audit trail** for tracking findings over time
- An interactive **governance dashboard** with risk heatmaps, finding filters, trend views, and run comparisons
- A **YAML-driven policy configuration** system for customising governance rules per domain

The platform runs entirely locally. No cloud account is required.

## Project Context

This project was originally developed as a hackathon/portfolio project focused on enterprise AI governance tooling. It is designed to demonstrate full-stack TypeScript development, governance workflow design, audit tracking, risk scoring, and compliance monitoring.

The portfolio version runs entirely locally without requiring any cloud services. Service integrations (such as AI-generated recommendations) are optional and disabled by default when the relevant environment variables are absent.

## Key Features

The following features are implemented in the codebase:

- **Automated repository audit pipeline** — GitHub file ingestion → multi-domain scanner analysis → scoring → persistence
- **Security scanner** — detects hardcoded secrets, credential filename patterns, and suspicious file exposure
- **Privacy scanner** — detects PII patterns (emails, phone numbers, national identifiers) in code and paths
- **Responsible-AI scanner** — checks for missing governance docs, absent content-safety controls, missing evaluation frameworks, prompt injection patterns, and absent human-review signals
- **Governance scoring engine** — weighted penalty model producing a 0–100 score and risk level (low / moderate / high)
- **Governance policy configuration** — YAML-driven policy toggles per audit domain (security, privacy, responsible AI)
- **Baseline policy rules** — configurable suspicious file lists, secret patterns, and PII patterns loaded at runtime
- **Audit run persistence** — PostgreSQL-backed via Prisma ORM; findings stored as structured JSON with full evidence and recommendations
- **Governance dashboard** — Next.js frontend with audit run management, finding detail view, severity/category filters, and keyword search
- **Risk heatmap** — category × severity matrix visualising finding distribution across an audit run
- **Trend analysis** — governance score and finding count trends across multiple audit runs
- **Run comparison** — side-by-side comparable run view
- **Governance policies endpoint** — REST endpoint serving active policy configuration to the frontend

### Optional / Extensible Integrations

The codebase includes an optional AI recommendations service. When the relevant environment variables are provided, the API calls an OpenAI-compatible chat completions endpoint to generate an executive summary and recommended actions per audit run. If the variables are absent, this step is silently skipped and the rest of the audit pipeline runs normally.

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript (strict, across all packages) |
| Monorepo | Turborepo with npm workspaces |
| Frontend | Next.js 16, React 19 |
| Backend | NestJS 11 |
| ORM | Prisma 6 |
| Database | PostgreSQL |
| Linting | ESLint, Prettier |
| Testing | Jest, Supertest |
| Node | ≥ 18 |

**Optional integrations:** Cloud or AI service integrations can be added through environment variables and are not required for local portfolio use.

## Architecture

```
enterprise-ai-governance-copilot/
├── apps/
│   ├── api/          # NestJS backend — audit pipeline, scanners, scoring, REST API
│   └── dashboard/    # Next.js frontend — governance dashboard, heatmap, trends
├── packages/
│   ├── ui/           # Shared React component library
│   ├── eslint-config/      # Shared ESLint configuration
│   └── typescript-config/  # Shared tsconfig presets
└── policies/
    └── baseline.yml  # Root-level baseline policy rules (secret patterns, suspicious files)
```

### Backend Modules (`apps/api/src`)

| Module | Responsibility |
|---|---|
| `audit-runs` | Audit run lifecycle: create, persist, orchestrate scanners, score, generate AI recommendations |
| `policies` | Load and serve YAML governance policy configuration |
| `prisma` | Prisma client provider |

Key services within `audit-runs`:

- `GithubIngestionService` — fetches and samples repository files via the GitHub API
- `SecurityScannerService` — applies security policy rules
- `PrivacyScannerService` — applies privacy policy rules
- `ResponsibleAiScannerService` — applies responsible-AI policy rules
- `ScoringService` — calculates governance score and risk level
- `FoundryRecommendationsService` — calls an OpenAI-compatible endpoint (optional) to generate remediation guidance

### Data Model

```prisma
model AuditRun {
  id        String   @id @default(uuid())
  repoUrl   String
  status    String   @default("pending")
  findings  Json?
  createdAt DateTime @default(now())
}
```

Findings are stored as structured JSON including per-finding evidence, severity, category, code snippets, and recommendations, plus an `auditSummary` score block and an optional `aiRecommendations` block (populated only when AI integration is configured).

## What This Demonstrates

- **Full-stack TypeScript** — end-to-end type safety across frontend, backend, and shared packages
- **Monorepo architecture** — Turborepo pipeline orchestration, workspace-scoped packages, shared ESLint and tsconfig
- **Backend API design** — NestJS modules, dependency injection, service composition, REST controllers
- **Relational data modelling** — Prisma schema with PostgreSQL, JSON columns for flexible findings storage
- **Governance and compliance domain thinking** — responsible-AI checks, risk scoring, policy-as-code via YAML, audit trail persistence
- **Dashboard development** — Next.js frontend with filtering, heatmaps, trend views, and run comparisons
- **Structured project delivery** — scanners encapsulate individual policy domains with consistent, composable finding interfaces

## Local Development

### Prerequisites

- Node.js ≥ 18
- npm ≥ 11
- A running PostgreSQL instance

No cloud account is required. All core features run locally.

### Setup

```bash
# Install all workspace dependencies
npm install

# Set up environment variables (see section below)
cp .env.example .env   # or create apps/api/.env manually

# Run Prisma migrations
cd apps/api
npx prisma migrate deploy

# Return to root and start all apps
cd ../..
npm run dev
```

### Individual App Scripts

```bash
# Start all apps concurrently (via Turborepo)
npm run dev

# Start API only
npm run dev:api

# Start dashboard only
npm run dev:dashboard

# Build all apps
npm run build

# Lint all packages
npm run lint

# Run all tests
npm run test
```

By default the API runs on `http://localhost:3001` and the dashboard on `http://localhost:3000`.

## Environment Variables

Create an `apps/api/.env` file. **Do not commit real values.**

### Required

```env
# PostgreSQL connection string
DATABASE_URL="postgresql://user:password@localhost:5432/enterprise_ai_governance"
```

### Optional

```env
# GitHub personal access token — increases GitHub API rate limits for repository ingestion
GITHUB_TOKEN="your_github_personal_access_token"
```

### Optional integrations

These variables enable the AI recommendations feature. If any are absent, the feature is silently skipped and all other audit functionality works normally.

```env
AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com"
AZURE_OPENAI_API_KEY="your_api_key"
AZURE_OPENAI_DEPLOYMENT_NAME="your_deployment_name"
AZURE_OPENAI_API_VERSION="2024-10-21"
```

For the dashboard, set the API base URL if it differs from the default:

```env
# apps/dashboard/.env.local
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

## Repository Status

**Portfolio / hackathon project — active prototype.**

Core audit pipeline, scoring, policy engine, and dashboard are implemented. The project is under active development.

## Security Notice

No production secrets, API keys, database credentials, or deployment endpoints should be committed to this repository. Use local environment variable files (`.env`, `.env.local`) which are excluded from version control. Rotate any credentials immediately if accidentally exposed.

