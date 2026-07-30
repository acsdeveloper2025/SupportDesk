# Observability

Use structured logs, metrics, distributed traces, Audit Events, and product analytics for distinct purposes. Telemetry includes timestamp, environment, service/module, severity, correlation/trace, operation, outcome, latency, and pseudonymous Tenant key where permitted. Never log credentials, tokens, Comment bodies, attachment contents, raw email, or unnecessary Personal data.

## Signals

- **Golden signals:** request rate, error, latency, saturation by operation; queue age/depth/retry/dead-letter; database/cache/search/object/provider health.
- **Domain signals:** Ticket creation/transition failures, Workflow matched/actions/failures, SLA evaluation lag/breach, notification intent/delivery state, audit persistence, and isolation denials.
- **SLOs:** dashboards implement NFR-01–NFR-06 with numerator, denominator, windows, exclusions, and burn rate.

Alerts must be actionable, symptom-based, deduplicated, severity-mapped, owned, and linked to a tested runbook. Page on fast/slow availability burn, audit-write failure, suspected cross-Tenant access, authentication compromise, unrecoverable write failure, or critical queue age. Ticket lower urgency for capacity trend and noncritical provider degradation.

Telemetry access is least-privilege and audited. Retention is class-specific and pending OQ-06. Sampling preserves errors and security signals; correlation remains available across requests, outbox, workers, and vendors. Synthetic probes exercise authentication, Ticket read/write, and notification preparation without customer data.
