# E11-I02 Workflow Validation & Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add publish-gate validation with structured reports plus validate / clone-draft / version-diff governance APIs — without workflow execution.

**Architecture:** Pure domain validators + Nest `WorkflowValidationService` for DB reference checks; wire into `WorkflowsService.publish` and three new controller routes. Diff immutable `workflow_versions` JSON snapshots only.

**Tech Stack:** NestJS, Prisma/Postgres, Vitest, existing RBAC/`ConfigPublicationState`, ticket `VALID_TRANSITIONS` matrix.

**Spec:** `docs/superpowers/specs/2026-08-01-workflow-validation-governance-design.md`

## Global Constraints

- No execution, outbox, workers, queues, email, webhooks.
- Group refs/conditions → `WORKFLOW_GROUP_UNSUPPORTED` (ADR-0008).
- Warnings never block publish; only `errors` do.
- Report `schemaVersion: 1`; issues sorted by path, severity, code.
- Diff includes `generatedAt`, `changeCount`; snapshot-based.
- Branch: `feat/e11-i02-workflow-validation`; stop before E11-I03.
- Keep files small; match existing workflows module patterns.

## File map

| File | Responsibility |
| ---- | -------------- |
| `domain/workflow-validation.ts` | Pure structural/limit/semantic/cycle report building + sort |
| `domain/workflow-validation.spec.ts` | Unit tests for rules |
| `domain/workflow-diff.ts` | Pure snapshot diff |
| `domain/workflow-diff.spec.ts` | Diff unit tests |
| `workflow-validation.service.ts` | Orchestrate pure + user existence lookups |
| `workflows.service.ts` | validate, cloneDraft, diffVersions, publish gate |
| `workflows.controller.ts` | New routes |
| `dto/workflows.dto.ts` | DTOs for report/clone/diff |
| `workflows.module.ts` | Register validation service |
| `ticketing/domain/ticket.aggregate.ts` | Export `isAllowedTicketTransition` (surgical) |
| Docs: ADR-0011, api/workflows, errors, audit-events, decision-log, CHANGELOG |
| Specs: openapi + integration |

---

### Task 1: Pure validation + diff domain (TDD)

**Files:** `domain/workflow-validation.ts`, `.spec.ts`, `domain/workflow-diff.ts`, `.spec.ts`; export transition helper from `ticket.aggregate.ts`

- [ ] Export `isAllowedTicketTransition(from, to)` from ticket aggregate (reuse `VALID_TRANSITIONS`).
- [ ] Write failing unit tests for: limits, illegal transition, group unsupported, unknown UUID user path (pure skips DB — mark path for service), cycle risk, issue sorting, `schemaVersion`.
- [ ] Implement `buildStructuralAndSemanticReport(definition)` → report without DB refs.
- [ ] Implement `sortValidationIssues`, `finalizeReport`.
- [ ] Write failing diff tests; implement `diffWorkflowSnapshots`.
- [ ] Commit: `feat(workflows): add pure validation and version diff domain`

### Task 2: Validation service + publish gate

**Files:** `workflow-validation.service.ts`, `workflows.service.ts`, `workflows.module.ts`

- [ ] Service: run pure report; lookup user IDs referenced by assign actions / assignee|requester conditions; append `WORKFLOW_UNKNOWN_USER` or ok.
- [ ] `publish`: full validate; if errors, `BadRequestException` with report body + optional FAILURE audit; else existing publish TX.
- [ ] create/update: structural+limits only via shared helper.
- [ ] Unit/integration coverage for blocked publish.
- [ ] Commit: `feat(workflows): gate publish on full validation report`

### Task 3: Governance APIs

**Files:** controller, dto, service methods, openapi.spec, integration.spec

- [ ] `POST :id/validate` → `workflow.read`
- [ ] `POST :id/clone-draft` → `workflow.update`; CONFLICT if draft exists
- [ ] `GET :id/versions/:from/diff/:to` → `workflow.read`
- [ ] Audit `workflow.validated`, `workflow.draft_cloned`
- [ ] OpenAPI + PG integration tests
- [ ] Commit: `feat(workflows): add validate clone-draft and version diff APIs`

### Task 4: Documentation + ADR-0011

**Files:** ADR-0011, adr/README, decision-log, api/workflows.md, errors.md, audit-events.md, CHANGELOG

- [ ] Document APIs as Implemented; update deferred table (I02 done; I03 remains).
- [ ] Commit: `docs(workflows): document E11-I02 validation governance`

### Task 5: Quality gates

- [ ] `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm security:scan` (from repo root / api as appropriate)
- [ ] Fix any failures
- [ ] Push branch; open PR stacked on #34 if requested
- [ ] Stop for E11-I03 approval
