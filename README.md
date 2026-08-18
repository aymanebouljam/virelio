# Virelio

Virelio is a multi-tenant expense tracker for managing vendors, business expenses, receipts, recurring costs, and spending reports. The current pre-release is `v0.8.0`.

## Features

- Registration, JWT authentication, protected routes, and profile settings
- Tenant-isolated vendors, expense categories, expenses, proofs, dashboards, and reports
- Vendor, category, and expense creation, editing, archiving, restoration, and removal
- Search, filters, stable pagination, and URL-persisted list state
- Private receipt and invoice uploads with authenticated downloads
- Date-filtered dashboard summaries and recent activity
- Monthly, vendor, and category-comparison reporting
- Spreadsheet-safe CSV expense exports
- Weekly, monthly, and yearly recurring expense templates with due-expense generation
- Keyboard navigation, accessible validation feedback, and visible audit timestamps

## Technology

Virelio is a pnpm workspace containing:

- `backend/` — NestJS 11 REST API, Prisma 7, and PostgreSQL
- `frontend/` — Vue 3, Vue Router, Vite, Tailwind CSS, and Zod

The backend is organized into domain modules for authentication, vendors, expense categories, expenses, proofs, dashboard summaries, reports, and recurring expenses. Prisma migrations define the data model, and each user-owned resource is scoped by the authenticated user ID.

## Requirements

- Node.js `>=24 <26`
- pnpm `11.x`
- PostgreSQL

## Local Setup

Install dependencies from the repository root:

```bash
pnpm install
```

Create the local environment files:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Configure `backend/.env` with a PostgreSQL connection string and a strong local JWT secret. `BACKEND_ROOT` identifies the backend directory for file storage, and `UPLOADS_DIR` is resolved relative to it.

Apply the migrations and optionally load development data:

```bash
pnpm prisma:migrate:dev
pnpm seed
```

Start the API and frontend in separate terminals:

```bash
pnpm dev:backend
pnpm dev:frontend
```

By default, the API listens on `http://localhost:3000` and Vite serves the frontend on `http://localhost:5173`.

## Commands

Run repository-wide checks from the root:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Useful development commands:

```bash
pnpm format
pnpm lint:fix
pnpm seed
pnpm test:e2e
```

Prisma commands:

```bash
pnpm prisma:format
pnpm prisma:generate
pnpm prisma:validate
pnpm prisma:migrate:dev
pnpm prisma:migrate:deploy
pnpm prisma:migrate:test
```

Backend end-to-end tests use `backend/.env.test` and require its dedicated PostgreSQL database to be available. They run serially because the suites reset shared test data.

## Data and Security Model

- API validation strips unknown properties and rejects non-whitelisted input.
- Business resources are tenant-scoped and inaccessible across users.
- Vendor and category uniqueness is enforced per user.
- Proof metadata is stored in PostgreSQL while files are stored on local disk for the current pre-release.
- Proof files are delivered only through authenticated, ownership-checked endpoints; there is no public uploads route.
- Permanent removal is generally restricted to records that have first been archived.

Local proof storage is suitable for development and the current pre-release, but production deployment still requires durable storage, backups, monitoring, and a security review.

## Testing and CI

The test suite includes backend service tests, database-backed API end-to-end tests, frontend unit tests, and page-level workflow tests. Tenant-isolation coverage verifies that users cannot access one another's records or proof documents.

CI runs formatting, linting, typechecking, unit and component tests, PostgreSQL migrations, end-to-end tests, and production builds. The PostgreSQL service and third-party CI actions are pinned for reproducibility.

## Release Status

Virelio uses pre-`1.0` minor releases for complete user-facing milestones. Releases through `v0.8.0` cover the MVP, search and pagination, profile settings, accessibility and audit history, reporting insights, category comparisons, recurring expenses, authentication error handling, and hardened proof uploads.

The application is feature-complete for its current pre-release scope, but it is not yet described as production-ready. See [CHANGELOG.md](CHANGELOG.md) for release details.
