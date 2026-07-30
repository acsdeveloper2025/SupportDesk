# Scripts

This directory is reserved for repository automation scripts.

Bootstrap currently uses package scripts from the root `package.json`:

- `pnpm dev`
- `pnpm build`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm docker:dev`

Future scripts must stay infrastructure-focused unless a milestone explicitly approves feature implementation.
