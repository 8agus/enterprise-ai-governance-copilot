## Tech stack: TypeScript, Next.js, NestJS

## Always:
- small changes
- keep types strict
- add tests (where it adds value for judging)
- never log secrets
- evidence-based findings only (file+line)
- no refactoring unrelated files

## Preferred libs:
- zod for validation
- prisma for DB
- octokit for GitHub API

## Output style:
- step-by-step, with commands to run (assume repo root)
- include acceptance criteria checklist

## Ticket Handover Requirement:
- When implementing tickets, Copilot must always produce a "Ticket Implementation Handover" summary using the following structure:
	- Ticket
	- Goal
	- Diff Summary
	- Modified Files
	- Validation
	- Scope Check
- The response must be inside a single Markdown code block to allow easy copy/paste.

