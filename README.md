# Virelio

Virelio is a multi-tenant expense tracker for vendors, expenses, receipts, recurring costs, and spending reports. Current stable release: `v1.1.0`.

## Features

- Authenticated, tenant-isolated vendor, category, expense, proof, dashboard, report, and recurring-expense management
- Search, filters, URL-backed pagination, archival, restoration, and removal workflows
- Private proof uploads, CSV export, email verification, password reset, profile settings, reporting, and accessible forms

## Technology

- `backend/` — NestJS 11, Prisma 7, PostgreSQL, Jest
- `frontend/` — Vue 3, Vite, Tailwind CSS, Zod, Vitest
- Requires Node.js `>=24 <26`, pnpm `11.x`, and PostgreSQL

## Local Setup

```bash
pnpm install
pnpm env:setup
```

`pnpm env:setup` copies the example files and replaces existing local environment files. Set a PostgreSQL connection string and JWT secret in both backend files. `backend/.env.test` must use a dedicated database because end-to-end tests erase its data. Set `VITE_API_BASE_URL` in `frontend/.env`.

With both databases available, generate the Prisma client, apply the development and test migrations, and load the development seed data:

```bash
pnpm database:setup
```

For local verification and password-reset links, open `backend/.local/auth-emails.log` and use the link in the newest message:

```text
From: Virelio <noreply@virelio.test>
To: owner@example.test
Subject: Verify your email

http://localhost:5173/verify-email?token=example-token
```

Start the app:

```bash
pnpm dev
```

By default, the API listens on `http://localhost:3000` and Vite serves the frontend on `http://localhost:5173`.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start API and frontend |
| `pnpm env:setup` | Create local environment files from the example templates (replaces existing files) |
| `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` | Run an individual quality check |
| `pnpm qa` | Run the complete release gate |
| `pnpm database:setup` | Generate Prisma, migrate both databases, and seed development data |
| `pnpm test:e2e` | Run backend end-to-end tests |
| `pnpm prisma:migrate:dev` | Create and apply a development migration |
| `pnpm prisma:migrate:reset` | Reset the development database and apply all migrations (destructive) |
| `pnpm --filter frontend exec vitest run src/__tests__/router.spec.ts` | Run one frontend test file |
| `pnpm --filter backend cleanup:auth-tokens` | Remove expired authentication tokens |

Run token cleanup daily in production.

## Deployment notes

Resources are scoped to the authenticated user; proof downloads require ownership checks; validation rejects unknown input; and CSV exports guard against spreadsheet formulas.

Proof metadata lives in PostgreSQL, but files use local disk. Before production deployment, provide durable storage, backups, monitoring, and a security review.

## Testing and release

CI runs formatting, linting, typechecking, unit tests, migrations, end-to-end tests, and production builds. See [CHANGELOG.md](CHANGELOG.md) for release details.
