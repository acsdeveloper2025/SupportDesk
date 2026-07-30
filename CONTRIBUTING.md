# Contributing

Read [AGENTS.md](AGENTS.md) and the [glossary](docs/glossary.md) first. Open an issue or proposal for material product or architectural change. Reference stable IDs in branches, commits, tests, and pull requests.

## Documentation workflow

1. State the user or operational outcome and impacted `PR-*` IDs.
2. Add or update `FR-*` rules and Given/When/Then acceptance criteria.
3. Update the traceability matrix and affected design, security, test, deployment, and roadmap documents.
4. Add an ADR entry for a durable choice; leave unresolved options in Open Questions.
5. Check links, Mermaid syntax, terminology, and contradictions.

## Pull requests

Use an imperative title and include: summary; requirements/ADRs; tenant, security, privacy, and accessibility impact; tests; migration; rollout/rollback; monitoring; documentation; and open risks. Keep changes focused. All policies, gates, review requirements, and Definition of Done are normative in [AGENTS.md](AGENTS.md).

## Commit style

Prefer `docs: establish ticket workflow contract` or equivalent `<area>: <imperative outcome>`. Never include credentials or customer data in commits, examples, fixtures, or screenshots.
