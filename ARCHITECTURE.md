# Architecture

## Requested stack
- `enterprise` (Angular 19 + NestJS + tRPC + Prisma + PostgreSQL) — fixed by the platform for this project.

## Scaffolding status
- **enterprise** — ✅ newly scaffolded. No prior source existed (repo contained only `.git`, `.github/`, and a `README.md` stub).

## Layout
- `frontend/` — Angular 19 standalone-component SPA (project name: `frontend`). Entry: `frontend/src/app/app.component.ts`. Home feature: `frontend/src/app/home/home.component.ts`. tRPC client wiring in `frontend/src/app/app.config.ts`.
- `backend/` — NestJS 10 API with a tRPC layer (`nestjs-trpc`) and Prisma/PostgreSQL. Entry: `backend/src/main.ts`. tRPC routers under `backend/src/*/*.router.ts`, REST health check at `backend/src/health/health.controller.ts`.
- `.pipeline/surface.json` — generated manifest of routes, components, and `data-testid`s; the contract used by the test_spec agent and Playwright generator. Regenerate/extend this whenever routes, components, or testids change.
- `.colossus-acceptance.json` — acceptance contract for the post-deploy render gate (`ready_testid: app-ready`). The coder must fill `expect_text` with real front-page content once the app is customized.
- `colossus.yaml` — build manifest read by deploy agents (Angular frontend + NestJS backend, output at `dist/frontend/browser`, backend on port 3001).

## Note on the plan vs. the scaffolded stack
The technical plan above (`StockRoom` inventory app) describes a different stack shape (NestJS + Prisma/Postgres API with a single Dockerfile serving Angular + API under `/api`, JWT auth, items/locations/movements/reports domain). Per the platform's stack contract, this run scaffolds the **fixed `enterprise` template** (separate `frontend/` and `backend/` roots, tRPC as the API layer) rather than the plan's bespoke layout. The plan's **features** (auth, items, locations, movements, reports, RBAC, low-stock reporting, etc.) should be implemented by subsequent build agents on top of this template's structure and conventions — not by re-scaffolding a different repo layout.

## Next steps for the developer / build agents
1. Copy `.env.template` → `.env` at the repo root and in `backend/` if/when those templates are added to this project (none were present in the template as scaffolded — check `backend/` for Prisma's `DATABASE_URL` requirement before running the API).
2. Run `docker-compose up` (see `docker-compose.yml`) to bring up PostgreSQL and the app locally, or run `frontend`/`backend` individually via their own tooling.
3. Run `npx prisma migrate dev` inside `backend/` once a `prisma/schema.prisma` is defined for the StockRoom domain models (User, Item, Location, StockLevel, Movement).
4. Extend `.pipeline/surface.json` as new tRPC procedures, REST routes, components, and `data-testid`s are added.
5. Fill in `.colossus-acceptance.json`'s `expect_text` once the real StockRoom front page (e.g. the `StockRoom` wordmark on the login page) is implemented.
6. Replace the `README.md` stub (`# Inventory-03`) with the project name, stack, local dev + seed instructions, and demo credentials, per the plan.

## Template sources
- `enterprise` ← `/app/scaffold-templates/template-enterprise/`
