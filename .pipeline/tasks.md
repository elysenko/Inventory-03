# Pipeline Task Decomposition

## Summary
StockRoom is a single-tenant inventory management app. Authenticated staff browse a catalog of items (sku, name, unit, reorder threshold) and stock locations (name, zone), record stock movements (`IN`, `OUT`, `TRANSFER`) that atomically adjust per-location balances, and read an audit log of every movement. Managers additionally get catalog/location write access, the movement audit log, and a low-stock report (`SUM(stockLevel.qty) <= item.reorderAt`, including items with no stock rows). Auth is JWT bearer with two roles — `manager` (the admin-equivalent role) and `clerk` (the standard user role); first signup on an unseeded database becomes `manager`, all later signups become `clerk`. The scaffolded stack is the fixed `enterprise` template: Angular 19 standalone SPA in `frontend/`, NestJS 10 + Prisma/PostgreSQL in `backend/`, served as nginx-frontend + backend behind `/api`.

## Surface contract

### Stack roots (from scaffolder — the spec's `api/` + `web/` layout does NOT apply)
- Backend: `backend/` (NestJS 10, Prisma, entry `backend/src/main.ts`, global prefix `api`, port 3001)
- Frontend: `frontend/` (Angular 19 standalone, entry `frontend/src/app/app.component.ts`, build output `dist/frontend/browser`, `frontend/proxy.conf.json` for dev, nginx in production)
- Schema: `backend/prisma/schema.prisma`; seed: `backend/prisma/seed.ts` + `backend/prisma/seed/seed.js`
- Manifests to keep current: `.pipeline/surface.json`, `.colossus-acceptance.json`, `colossus.yaml`

### Entities
- `User(id, email @unique, passwordHash, role Role, createdAt)`; `enum Role { clerk manager }`
- `Item(id, sku @unique, name, description?, unit, reorderAt Int, createdAt)`
- `Location(id, name @unique, zone)`
- `StockLevel(id, itemId, locationId, qty Int @default(0))`, `@@unique([itemId, locationId])`
- `Movement(id, type MovementType, itemId, fromLocId?, toLocId?, qty Int, note?, userId, createdAt)`; `enum MovementType { IN OUT TRANSFER }`
- `SystemSetting(key String @id, value String, updatedAt DateTime @updatedAt)`

### API routes (REST, all under `/api`)
| Method + path | Access |
|---|---|
| `GET /api/health`, `GET /api/health/deep` | public |
| `POST /api/auth/login`, `POST /api/auth/signup` | public |
| `GET /api/auth/me` | authenticated |
| `GET /api/items` (`?q=&lowStock=&page=&pageSize=`) | clerk + manager |
| `GET /api/items/:id` (with per-location `stockLevels`) | clerk + manager |
| `GET /api/items/:id/movements` | clerk + manager |
| `POST /api/items`, `PATCH /api/items/:id`, `DELETE /api/items/:id` | manager |
| `GET /api/locations` | clerk + manager |
| `POST /api/locations`, `PATCH /api/locations/:id`, `DELETE /api/locations/:id` | manager |
| `POST /api/movements` | clerk + manager |
| `GET /api/movements` (`?itemId=&type=&from=&to=&locationId=&page=`) | manager |
| `GET /api/reports/low-stock` | manager |
| `GET /api/admin/settings`, `PATCH /api/admin/settings` | manager |

### Screens (every navigable state URL-addressable, each route carries `data.flow`)
| Route | Guard | `data.flow` |
|---|---|---|
| `/login` | public | `auth.login` |
| `/signup` | public | `auth.signup` |
| `/items?q=&lowStock=&page=` | auth | `items.list` |
| `/items/new` | manager | `items.create` |
| `/items/:id` → redirect `/items/:id/locations` | auth | `items.detail` |
| `/items/:id/locations` | auth | `items.detail.locations` |
| `/items/:id/movements` | auth | `items.detail.movements` |
| `/items/:id/edit` | manager | `items.edit` |
| `/locations?q=` | auth | `locations.list` |
| `/locations/new` | manager | `locations.create` |
| `/locations/:id/edit` | manager | `locations.edit` |
| `/movements/new?step=1..3` | auth | `movements.create` |
| `/movements?itemId=&type=&from=&to=&page=` | manager | `movements.log` |
| `/reports/low-stock` | manager | `reports.lowStock` |
| `/admin/settings` | manager | `admin.settings` |
| `''` → `/items`, `**` → `/items` | — | — |

### Invariants
- `TRANSFER` requires distinct `fromLocId` + `toLocId`; `IN` requires `toLocId` only; `OUT` requires `fromLocId` only; `qty >= 1`.
- An over-draw never writes: guarded `updateMany` + rollback, balance unchanged after a 400.
- Low-stock predicate is `<=` (boundary `totalOnHand === reorderAt` IS listed).
- Sum of an item's per-location `qty` always equals its `totalOnHand`.
- Unauthenticated → 401; authenticated-but-wrong-role → 403 (never conflated).
- The literal text `StockRoom` is rendered on the unauthenticated login page body, not only in the shell or `<title>`.

## db_agent tasks
- [ ] Replace the scaffolded placeholder Prisma models in `backend/prisma/schema.prisma` with the StockRoom domain (remove the template's demo `User`/tRPC-era models so nothing stale remains).
- [ ] Define `enum Role { clerk manager }` and the `User` model (`id cuid`, `email @unique`, `passwordHash`, `role Role @default(clerk)`, `createdAt`) — `manager` is the admin-equivalent role, `clerk` the standard user role.
- [ ] Define `Item(id, sku @unique, name, description String?, unit, reorderAt Int, createdAt)`.
- [ ] Define `Location(id, name @unique, zone)` and `StockLevel(id, itemId, locationId, qty Int @default(0))` with `@@unique([itemId, locationId])` and indexes on `itemId` and `locationId`.
- [ ] Define `enum MovementType { IN OUT TRANSFER }` and `Movement(id, type, itemId, fromLocId String?, toLocId String?, qty Int, note String?, userId, createdAt @default(now()))` with `@@index([itemId, createdAt])` and `@@index([createdAt])`, plus named relations for `fromLoc`/`toLoc`.
- [ ] Define `SystemSetting(key String @id, value String, updatedAt DateTime @updatedAt)` to back admin-configurable credentials for the provisioned services (`postgresql`, `minio`).
- [ ] Generate and commit the initial migration under `backend/prisma/migrations/`; confirm `npx prisma generate` and `npx prisma migrate deploy` both succeed.
- [ ] Write the idempotent seed (`backend/prisma/seed.ts`, kept in sync with `backend/prisma/seed/seed.js` so the scaffolded seed path still runs): upsert `manager@demo` and `clerk@demo` (password `Demo1234!`, bcrypt cost 10), locations `Zone A`/`Zone B`/`Zone C`, 8 items with varied `reorderAt` such that at least two land at or below threshold, and opening `IN` movements + matching `StockLevel` rows so both the low-stock report and the audit log are non-empty on a fresh deploy. Guard on `SEED_ON_BOOT !== 'false'`.

## backend_agent tasks
- [ ] Configure `backend/src/main.ts`: `app.setGlobalPrefix('api')`, `ValidationPipe({ whitelist: true, transform: true })`, listen on `PORT` (default 3001), CORS enabled for the dev proxy origin only.
- [ ] Wire `backend/src/app.module.ts`: global `ConfigModule`, existing `PrismaModule`, plus `AuthModule`, `UsersModule`, `ItemsModule`, `LocationsModule`, `MovementsModule`, `ReportsModule`, `AdminSettingsModule`.
- [ ] Extend `backend/src/health/health.controller.ts` with public `GET /api/health` (liveness) and `GET /api/health/deep` (`SELECT 1` via Prisma), both marked `@Public()`.
- [ ] Build `backend/src/auth/`: `jwt.strategy.ts` (HS256, `JWT_SECRET`, 12h expiry, payload `sub`/`email`/`role`), `jwt-auth.guard.ts` and `roles.guard.ts` registered as `APP_GUARD`s so every endpoint is protected by default, `public.decorator.ts`, `roles.decorator.ts`, `current-user.decorator.ts`.
- [ ] Implement `auth.service.ts` + `auth.controller.ts` with `dto/login.dto.ts` and `dto/signup.dto.ts`: `POST /api/auth/login` (bcrypt compare, 401 on miss, returns `{ accessToken, user }`), `POST /api/auth/signup` (409 on duplicate email; role = `manager` when `userCount === 0`, else `clerk`), `GET /api/auth/me` for SPA bootstrap. Logout is client-side token discard.
- [ ] Implement `backend/src/users/users.module.ts` + `users.service.ts` (find by email/id, create with hashed password, count) — no public controller.
- [ ] Implement `backend/src/items/` controller + service + DTOs: `GET /api/items` with `?q=` (sku/name contains, insensitive), `?lowStock=true`, `?page=`/`?pageSize=`, each row carrying computed `totalOnHand`; `GET /api/items/:id` including `stockLevels` with related location.
- [ ] Add manager-gated `POST/PATCH/DELETE /api/items` with `@Roles('manager')`: map Prisma `P2002` on `sku` to a `ConflictException` with a field-level message, and block delete with 409 when any non-zero `StockLevel` or any `Movement` references the item.
- [ ] Implement `backend/src/locations/`: `GET /api/locations` for all authenticated roles, manager-gated `POST/PATCH/DELETE`, duplicate `name` → 409, delete blocked with 409 when referenced by stock or movements.
- [ ] Implement `backend/src/movements/movements.service.ts` `create(dto, user)` inside `prisma.$transaction(..., { isolationLevel: 'Serializable' })`: validate item/locations exist (404) and the type↔location combination (400); debit via guarded `updateMany({ where: { itemId, locationId: fromLocId, qty: { gte: qty } }, data: { qty: { decrement: qty } } })` throwing `BadRequestException('Insufficient stock')` when `count === 0`; credit via `upsert` on `[itemId, locationId]`; write the `Movement` row with `userId` from the JWT; retry once on `P2034`.
- [ ] Add `POST /api/movements` (any authenticated role, returns the movement plus affected balances), manager-gated `GET /api/movements` with `?itemId=&type=&from=&to=&locationId=&page=`, `orderBy createdAt desc`, including `user.email`, `item`, `fromLoc`, `toLoc`; and clerk-accessible `GET /api/items/:id/movements` for the item-detail tab.
- [ ] Implement `backend/src/reports/`: manager-gated `GET /api/reports/low-stock` returning `{ item, totalOnHand, reorderAt, shortfall }` where `COALESCE(SUM(qty),0) <= reorderAt`, including items with zero stock rows, ordered by shortfall descending.
- [ ] Add `backend/src/lib/config.ts` exporting `resolveConfig(key: string): Promise<string | null>` — reads `process.env[key]` first, falls back to the `SystemSetting` row when the env value is absent or equals `PLACEHOLDER_CONFIGURE_IN_SETTINGS`, returns `null` if neither is set — plus a `ServiceUnconfiguredError` that maps to HTTP 503.
- [ ] Implement `GET /api/admin/settings` (lists the `postgresql` and `minio` credential keys with masked values and a configured/unconfigured status) and `PATCH /api/admin/settings` (upsert key/value pairs), both `@Roles('manager')`.
- [ ] Add `.env.example` / `backend/.env.example` documenting `DATABASE_URL`, `JWT_SECRET`, `PORT`, `SEED_ON_BOOT`, and the MinIO credential keys, and update `README.md` (replacing the `# Inventory-03` stub) with project name, stack, local dev + migrate + seed instructions, and the demo credentials.

## ui_agent tasks
- [ ] Rework `frontend/src/app/app.component.ts` into the app shell: header rendering the literal `StockRoom` wordmark, role-aware nav (Items, Locations, Record movement for everyone; Movement log, Low stock, Admin settings for managers only), logout button, `data-testid="app-ready"` on the ready container.
- [ ] Define `frontend/src/app/app.routes.ts` for every route in the surface contract with lazy standalone components, `data.flow` values, `''` → `/items` and `**` → `/items`; add functional `authGuard` and `roleGuard('manager')` in `frontend/src/app/core/` (roleGuard redirects clerks to `/items`, authGuard sends visitors to `/login?returnUrl=`).
- [ ] Build `frontend/src/app/features/auth/login.component.ts` and `signup.component.ts` (reactive forms). The login page must itself render the `StockRoom` wordmark plus a demo-credentials hint, since the smoke oracle loads the root unauthenticated.
- [ ] Build `features/items/item-list.component.ts`: table of sku, name, unit, reorderAt, totalOnHand with a low-stock badge; search box and `lowStock` toggle bound to query params; pagination; loading/empty/error states.
- [ ] Build `features/items/item-detail.component.ts` with the tab shell and child routes `item-locations-tab.component.ts` (per-location breakdown table with a summed footer that visibly equals totalOnHand) and `item-movements-tab.component.ts` (this item's movement history).
- [ ] Build `features/items/item-form.component.ts` for create + edit (manager-only routes), surfacing the duplicate-SKU 409 as an inline field error on `sku`.
- [ ] Build `features/locations/location-list.component.ts` (name, zone, distinct items stocked; `?q=` bound to query params) and `location-form.component.ts` for manager-only create/edit, including a clear message for the 409 delete-blocked case.
- [ ] Build `features/movements/movement-form.component.ts` as a three-step wizard driven by and restored from `?step=1..3`: (1) pick item, (2) pick type + location selects that switch on type and reject identical `TRANSFER` locations, (3) qty + note + confirm showing the source balance; on success route to the item detail.
- [ ] Build `features/movements/movement-log.component.ts`: manager-only table of timestamp, user email, item, type, qty, from → to, note, with item/type/date-range filters written to query params.
- [ ] Build `features/reports/low-stock.component.ts`: manager-only list of item, on hand, reorderAt, shortfall, each row linking to the item detail; explicit empty state.
- [ ] Build `features/admin/settings.component.ts` at `/admin/settings` (manager-only): one section per provisioned service — `postgresql` and `minio` — each with a configured/unconfigured badge and a credential form, plus a banner listing anything still needing credentials ("The following need credentials to activate: …").
- [ ] Apply shared presentation: `frontend/src/index.html` `<title>StockRoom</title>`, global styles in `frontend/src/styles.css`, consistent loading/empty/error partials, and `data-testid` attributes on every table, form control, badge, and nav link the tester needs.
- [ ] Update `.pipeline/surface.json` (all routes, components, testIds — replacing the scaffolded `home`/`users` entries) and fill `.colossus-acceptance.json` `expect_text` with `StockRoom`.

## service_agent tasks
- [ ] Write `frontend/src/app/core/models.ts` — typed interfaces for `User`, `Role`, `Item`, `ItemWithStock`, `Location`, `StockLevel`, `Movement`, `MovementType`, `LowStockRow`, `SettingEntry`, and paginated envelopes, matching the backend response shapes exactly.
- [ ] Write `frontend/src/app/core/api.service.ts` — the single typed HTTP client for `/api`, with methods for items (list with query params, get, create, update, delete, movements), locations (CRUD), movements (create, list), reports (low-stock), and admin settings (get, patch). No component may call `HttpClient` directly.
- [ ] Write `frontend/src/app/core/auth.service.ts` — `signal<User|null>`, token persistence in `localStorage`, `login`/`signup`/`logout`, bootstrap via `GET /api/auth/me`, and an `isManager()` computed used by nav and guards.
- [ ] Write `frontend/src/app/core/auth.interceptor.ts` — functional interceptor attaching `Authorization: Bearer <token>`; on 401 it clears auth state and routes to `/login` with `returnUrl`; it must not swallow 403s (those surface to the component).
- [ ] Update `frontend/src/app/app.config.ts` to provide `HttpClient` with the interceptor and the router, and retire the scaffolded tRPC client wiring (`frontend/src/app/trpc-client.types.ts` and its providers) now that the API layer is REST.
- [ ] Wire the items screens to the API: list query-param → request mapping (`q`, `lowStock`, `page`, `pageSize`), detail + per-location breakdown, create/edit submit, and translation of the 409 duplicate-SKU response into the form's `sku` field error.
- [ ] Wire the locations screens to the API, including surfacing the 409 delete-blocked response as a user-readable message.
- [ ] Wire the movement wizard: item + location option loading, current source balance lookup for client-side qty validation, `POST /api/movements`, and surfacing the server's 400 `Insufficient stock` as the authoritative error over the client-side check.
- [ ] Wire the manager surfaces: movement log filters → `GET /api/movements` query params, `GET /api/reports/low-stock`, and the admin settings page's `GET`/`PATCH /api/admin/settings` round trip with masked-value handling.

## tester tasks
- [ ] `backend/test/auth.e2e-spec.ts`: signup on an empty DB yields `manager`, the next signup yields `clerk`, duplicate email → 409, bad password → 401, and a no-token request to each data endpoint (`/api/items`, `/api/locations`, `/api/movements`, `/api/reports/low-stock`) → 401.
- [ ] `backend/test/rbac.e2e-spec.ts`: clerk `POST /api/items` → 403, clerk `GET /api/movements` → 403, clerk `GET /api/reports/low-stock` → 403, clerk `PATCH /api/admin/settings` → 403, while manager gets 2xx on each — asserting 403 is never returned as 401.
- [ ] `backend/test/movements.e2e-spec.ts` invariants: `IN` 0 → 50; `OUT` 50 → 30; `TRANSFER` 30/0 → 20/10 with the total conserved; `OUT` of 10 against 5 on hand returns 400 **and a follow-up GET still reads 5** (assert the rollback, not just the status).
- [ ] `backend/test/movements-concurrency.e2e-spec.ts`: fire two simultaneous `OUT` requests of 30 against a balance of 50 — exactly one succeeds, the balance lands at 20 and never goes negative, and no `P2034` leaks as a 500.
- [ ] `backend/test/items.e2e-spec.ts` catalog: creating a duplicate `SKU-001` returns 4xx and `GET /api/items?q=SKU-001` still returns exactly one row; `DELETE` of a referenced item → 409.
- [ ] `backend/test/reports.e2e-spec.ts` low-stock boundary: `reorderAt 10` with 12 on hand is absent, after an `OUT` of 5 it is present, `totalOnHand === reorderAt` is explicitly listed, an item with 40 on hand is absent throughout, and an item with no stock rows is listed.
- [ ] `backend/test/breakdown.e2e-spec.ts`: for a two-location item, `GET /api/items/:id` per-location quantities sum exactly to the list endpoint's `totalOnHand`.
- [ ] Playwright smoke: bring the stack up, load `/` unauthenticated and assert the rendered body text contains `StockRoom`; log in as `manager@demo` and `clerk@demo` and confirm the manager sees Movement log / Low stock / Admin settings nav entries and the clerk does not.
- [ ] Playwright routing/regression: deep-link to `/items/:id/movements`, `/movements/new?step=3`, and `/movements?type=OUT` in a fresh tab — each restores its own state after login rather than dumping the user at a default view; also assert `/movements` as a clerk redirects to `/items`.

## Open questions
- **API layer: REST vs tRPC.** The scaffolder produced the fixed `enterprise` template with `nestjs-trpc` (`glue.api_client: "trpc"`, demo router `backend/src/users/users.router.ts`). The spec's surface, test strategy, and error-code scenarios are all REST-path-based, so this decomposition specifies REST controllers under the `/api` prefix and retires the demo tRPC router/client. If the platform requires tRPC procedures instead, backend_agent + service_agent + tester tasks must be re-mapped procedure-by-procedure before work starts.
- **Layout drift from the spec.** The spec describes `api/` + `web/` in one container serving the SPA from `api/public`; the scaffold is `backend/` + `frontend/` with nginx serving the SPA and the backend on port 3001 (`serve_topology: nginx_frontend_plus_backend_supervisor`). Tasks target the scaffolded layout; the spec's single-Dockerfile and SPA-fallback-middleware steps are therefore dropped. Confirm the deploy manifests (`colossus.yaml`, per-root `Dockerfile`s) still satisfy the smoke oracle.
- **Angular version.** Spec says Angular 17; scaffold is Angular 19. Assumed compatible (standalone components + functional guards/interceptors are idiomatic in both); confirm the build output path stays `dist/frontend/browser`.
- **Role naming.** The pipeline auth context lists roles `admin, user` while the spec defines `Role { clerk manager }`. Assumed mapping: `manager` = admin-equivalent (owns `/admin/settings` and all manager-gated routes), `clerk` = standard user. Confirm before any external system depends on the literal role strings.
- **MinIO.** `minio` is provisioned as a backing service but the spec declares no file-storage behaviour (no attachments, images, or exports). Only its credential entries on `/admin/settings` are scoped here; no storage client or upload flow is specified.
- **Integrations.** `<spec_integrations>` contains a single sentinel entry named `None` with key `NONE_API_KEY`, matching the spec's "Integrations: None". No integration client modules are scoped; confirm no real third-party integration was intended.
- **Signup on a seeded deploy.** Because the seed creates users directly, "first signup becomes manager" never fires on a seeded environment — every signup yields a clerk. Intended per the spec, but it means the only manager path on a fresh deploy is the seeded credentials.
