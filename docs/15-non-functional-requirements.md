# Non-functional requirements

Targets are measured monthly in production unless noted. Availability objectives are accepted baseline assumptions pending OQ-05 approval.

| ID | Target |
|---|---|
| NFR-01 Availability | Ticket read/write and Agent workspace: 99.9%; configuration/reporting: 99.5%, excluding announced maintenance capped at 4 hours/quarter. |
| NFR-02 Latency | At p95: ordinary reads ≤400 ms, writes ≤700 ms, queue/list ≤800 ms; p99 ≤2× each, measured server-side under design load. |
| NFR-03 Scale | Baseline 10,000 active Tenants, 1,000 Agents/Tenant, 10 million Tickets/Tenant, and 1,000 sustained/3,000 burst requests/s platform-wide; validate before commitment (OQ-04). |
| NFR-04 Async | 99% Domain Events begin processing within 10 s and 99.9% within 60 s; notification terminal intent within 15 min, excluding provider delivery latency. |
| NFR-05 Search | 95% indexed within 30 s, 99.9% within 5 min; p95 query ≤1 s; UI discloses freshness. |
| NFR-06 Durability/recovery | No acknowledged committed write lost under single-component failure; baseline RPO ≤5 min and RTO ≤60 min, pending OQ-14. |
| NFR-07 Security | SEC-01–SEC-10; 100% privileged actions audited; critical/high release findings zero. |
| NFR-08 Accessibility | WCAG 2.2 AA on critical journeys with T-A11Y gates. |
| NFR-09 Observability | 100% critical services expose SLI dashboards; ≥95% requests have correlation and trace continuity; alerts have owner/runbook. |
| NFR-10 Maintainability | ≥80% changed-line unit coverage as a diagnostic floor; all changed domain rules have branch/negative tests; architecture contract gates pass. |

## Measurement

SLIs exclude synthetic traffic and separately label customer-caused invalid requests; exclusions cannot hide platform failure. Error-budget burn triggers release controls in [operations](19-operations-recovery.md). Performance tests use production-like cardinality, Tenant skew, attachments, and concurrency. Results and test environment are retained per release.
