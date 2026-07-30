# Architecture

## Context and containers

```mermaid
flowchart LR
  U[Requester / Agent / Administrator] --> EDGE[Web edge and API]
  MAIL[Email provider] <--> INTEG[Channel adapters]
  IDP[Identity provider] --> EDGE
  EDGE --> APP[Modular application]
  INTEG --> APP
  APP --> DB[(Transactional store)]
  APP --> OUT[(Outbox / queue)]
  OUT --> WORK[Background workers]
  WORK --> DB
  WORK --> OBJ[(Object storage)]
  WORK --> SEARCH[(Search index)]
  WORK --> MAIL
  APP --> OBS[Telemetry pipeline]
  WORK --> OBS
```

The initial architecture is a stateless, horizontally scalable modular monolith plus workers (ADR-001). Bounded contexts are Identity & Access, Tenant Administration, Ticketing, Automation, SLA, Communications, Search & Reporting, Audit, and Platform Operations. Calls across modules use explicit application contracts; only the owning module mutates its data.

## Request and event path

```mermaid
sequenceDiagram
  participant C as Client
  participant E as Edge
  participant A as Application
  participant D as Transactional store
  participant W as Worker
  participant X as External provider
  C->>E: Request + credentials + idempotency key
  E->>A: Authenticated User and Tenant context
  A->>A: Validate Permission and invariants
  A->>D: Atomic state + Audit Event + outbox
  D-->>A: Commit/version
  A-->>C: Result + correlation ID
  W->>D: Claim outbox idempotently
  W->>X: Side effect with deduplication key
  W->>D: Record terminal/retry state
```

## Architecture rules

- Transactional state is authoritative; search, caches, analytics, and notifications are projections.
- External effects never occur inside the state transaction. Consumers are at-least-once and idempotent.
- Optimistic concurrency protects aggregates; bounded retries apply only to safe operations.
- Backpressure, quotas, circuit breakers, timeouts, and dead-letter review prevent cascading failure.
- No synchronous dependency is added to the Ticket write path without an availability and latency review.

See [ADR entries](decision-log.md), [data model](12-data-model.md), and [NFRs](15-non-functional-requirements.md).
