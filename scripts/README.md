# Scripts

Repository automation scripts:

| Script                 | Purpose                                                                                                                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `verify-migrations.sh` | Drop/create a fresh Postgres database, run `prisma migrate deploy`, assert zero schema drift, and run ticket schema integration tests. Invoked by `pnpm migrate:verify` and `.github/workflows/migrate-verify.yml`. |

Root package scripts remain the primary developer entrypoints (`pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, `pnpm docker:dev`, `pnpm migrate:verify`, `pnpm run ci`).

Scripts must stay infrastructure-focused unless a milestone explicitly approves feature implementation.
