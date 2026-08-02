# SupportDesk Enterprise v1.0 — Developer Guide

This guide provides developers and open-source contributors with architectural context, code setup guidelines, testing standards, and contribution guidelines for SupportDesk Enterprise.

---

## 1. Codebase Architecture Overview

SupportDesk Enterprise is structured as a **Modular Monolith** in a pnpm monorepo:

```
SupportDesk/
├── apps/
│   ├── api/             # NestJS API backend (Modular Monolith)
│   │   ├── src/
│   │   │   ├── admin/         # Enterprise Administration Module
│   │   │   ├── assets/        # CMDB & Asset Management Module
│   │   │   ├── audit/         # Audit Event Infrastructure
│   │   │   ├── auth/          # Authentication & Session Management
│   │   │   ├── database/      # Prisma Service & Repositories
│   │   │   ├── notifications/ # Transactional Outbox & Notification Dispatch
│   │   │   ├── rbac/          # Role-Based Access Control
│   │   │   ├── reports/       # Reports & Analytics Engine
│   │   │   ├── sla/           # SLA Engine & Business Hours Clock
│   │   │   ├── ticketing/     # Core Ticket Management
│   │   │   └── workflows/     # Workflow Runtime Engine
│   └── web/             # Next.js 14 App Router (Vanilla CSS, Modern UI)
├── docs/                # Architectural & Operational Documentation
├── packages/            # Shared TypeScript configs & utilities
└── scripts/             # Migration verification & DR testing scripts
```

---

## 2. Architectural Boundaries & Domain Isolation

- **Domain Logic Protection**: Domain models must never depend directly on Web framework controllers, HTTP parameters, or vendor SDKs.
- **Tenant Isolation**: Every database entity must include `tenantId`. All queries must filter by `tenantId`.
- **Transactional Outbox**: Side effects (sending email, pushing webhooks) must never execute synchronously inside a DB mutation transaction. Enqueue an `OutboxEvent` record in the transaction instead.

---

## 3. Development Workflow & Commands

1. **Local Watch Development**:

   ```bash
   # Start API in watch mode
   cd apps/api && pnpm run dev

   # Start Web client in watch mode
   cd apps/web && pnpm run dev
   ```

2. **Database Schema & Migrations**:
   When changing `schema.prisma`:

   ```bash
   cd apps/api
   pnpm exec prisma migrate dev --name your_migration_name
   ```

3. **Running Test Quality Gates**:
   ```bash
   pnpm run lint
   pnpm run typecheck
   pnpm run test
   ```

---

## 4. Coding & Testing Standards

- Maintain 100% type safety without `any` types.
- Write integration tests (`*.integration.spec.ts`) for every service method.
- Verify migration drift before submitting PRs using `bash scripts/verify-migrations.sh`.
