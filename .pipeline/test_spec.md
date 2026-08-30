# Test Specification

> **Warning — `surface.json` is stale.** The committed `.pipeline/surface.json` is the scaffolder stub
> (`GET /health`, `GET /trpc/users.findAll`, `GET /trpc/users.findById`; `app-home` component; `users-*`
> testIds). It does **not** describe StockRoom. The authoritative surface used below is the
> "Surface contract" table in `.pipeline/tasks.md`, cross-checked against the spec. All three stub routes
> are still covered here (health for real, the two tRPC routes as retirement checks) so nothing declared in
> `surface.json` is silently dropped. `ui_agent` is tasked with rewriting `surface.json`; when it does,
> re-run this spec against the updated file — the endpoint list must not shrink.
>
> Two further deltas from the spec text, inherited from the scaffold and already resolved in `tasks.md`:
> roots are `backend/` + `frontend/` (not `api/` + `web/`), served as nginx + backend behind `/api` (not one
> container with SPA fallback middleware); and `GET|PATCH /api/admin/settings` + `/admin/settings` exist in the
> task decomposition but not in the product spec. They are tested here at contract level only.

## Coverage summary
- Total cases: 252 (163 API + 74 journey + 15 data integrity)
- API endpoints covered: 22 / 22 (20 StockRoom endpoints from the `tasks.md` surface contract + 2 retired tRPC routes from `surface.json`; `surface.json`'s 3 declared routes are 3/3 covered)
- User journeys covered: 14

## API tests

**Shared fixtures.** Unless a case states otherwise, tests run against a database seeded by
`backend/prisma/seed.ts`: users `manager@demo` / `clerk@demo` (both password `Demo1234!`), locations
`Zone A` / `Zone B` / `Zone C`, 8 items with opening `IN` movements, at least two items at or below
`reorderAt`. Tokens: `MGR` = bearer token from logging in as `manager@demo`, `CLK` = as `clerk@demo`.
Purpose-built fixtures are named per case (e.g. `WIDGET` = item `SKU-TEST-1`, `reorderAt 10`).
"401 shape" = HTTP 401 with a JSON body containing `statusCode: 401`; "403 shape" = HTTP 403 with
`statusCode: 403`. A 403 asserted as 403 must never arrive as 401, and vice versa.

### `GET /api/health`
- **Happy path**:
  - `A-001` No token, `GET /api/health` → 200, body `{ status: "ok" }` (or equivalent object with a truthy status field). Must not require auth.
- **Validation failures**:
  - `A-002` `POST /api/health` → 404 or 405 (route is GET-only).
- **Auth failures**:
  - `A-003` With a deliberately malformed `Authorization: Bearer garbage` header, still → 200 (public route ignores bad tokens rather than 401-ing liveness).
- **Idempotency / edge cases**:
  - `A-004` 5 sequential calls all → 200 with identical body; response time under 1s each (liveness must not touch the DB).

### `GET /api/health/deep`
- **Happy path**:
  - `A-005` No token, database up → 200, body reports a database check result (e.g. `{ status: "ok", database: "up" }`), proving a `SELECT 1` ran through Prisma.
- **Validation failures**:
  - `A-006` `POST /api/health/deep` → 404 or 405.
- **Auth failures**:
  - `A-007` No token → 200 (route is `@Public()`; must not be caught by the global `JwtAuthGuard`).
- **Idempotency / edge cases**:
  - `A-008` With `DATABASE_URL` pointed at an unreachable host, → 503 (or 500) with a non-`ok` status, and the process stays alive so `GET /api/health` still returns 200.

### `POST /api/auth/login`
- **Happy path**:
  - `A-009` `{ email: "manager@demo", password: "Demo1234!" }` → 200/201, body `{ accessToken: <non-empty string>, user: { id, email: "manager@demo", role: "manager" } }`; body contains no `passwordHash`. Decoded JWT payload has `sub`, `email`, `role: "manager"`, and `exp - iat ≈ 12h`.
  - `A-010` `{ email: "clerk@demo", password: "Demo1234!" }` → 200/201 with `user.role === "clerk"`.
- **Validation failures**:
  - `A-011` `{ email: "not-an-email", password: "Demo1234!" }` → 400, body mentions `email`.
  - `A-012` `{ email: "manager@demo" }` (missing `password`) → 400.
  - `A-013` `{}` → 400.
  - `A-014` `{ email: "manager@demo", password: "Demo1234!", role: "manager" }` → the extra `role` key is stripped by `whitelist: true` and is not honoured (response role is whatever the DB says).
- **Auth failures**:
  - `A-015` `{ email: "manager@demo", password: "wrong" }` → 401 shape; response body must not disclose whether the email exists.
  - `A-016` `{ email: "nobody@demo", password: "Demo1234!" }` → 401 shape, same message as `A-015`.
- **Idempotency / edge cases**:
  - `A-017` Two logins with the same credentials both → 200 and both tokens are independently accepted by `GET /api/auth/me`.
  - `A-018` Email match is case-insensitive **or** consistently case-sensitive: `MANAGER@DEMO` either logs in as `manager@demo` or returns 401 — assert whichever the implementation chose and that it is stable, never a 500.

### `POST /api/auth/signup`
- **Happy path**:
  - `A-019` Against an **empty** `User` table (`SEED_ON_BOOT=false`), `{ email: "first@test.dev", password: "Passw0rd!" }` → 201 with `user.role === "manager"`.
  - `A-020` Immediately after `A-019`, `{ email: "second@test.dev", password: "Passw0rd!" }` → 201 with `user.role === "clerk"`.
  - `A-021` Against the **seeded** DB, `{ email: "new@test.dev", password: "Passw0rd!" }` → 201 with `user.role === "clerk"` (the seed pre-creates users, so "first becomes manager" never fires — this is the documented intent).
- **Validation failures**:
  - `A-022` `{ email: "bad", password: "Passw0rd!" }` → 400.
  - `A-023` `{ email: "ok@test.dev", password: "" }` → 400.
  - `A-024` `{ email: "ok@test.dev", password: "Passw0rd!", role: "manager" }` → role escalation is impossible: response `user.role === "clerk"` on a seeded DB (extra property stripped by `whitelist: true`), and a subsequent `GET /api/items` with that token still gets 403 on manager-only routes.
- **Auth failures**:
  - `A-025` No token required → signup succeeds without an `Authorization` header (route is `@Public()`).
- **Idempotency / edge cases**:
  - `A-026` Signing up `manager@demo` (already seeded) → 409, and `SELECT count(*) FROM "User" WHERE email='manager@demo'` still equals 1.
  - `A-027` The stored record has a bcrypt hash, never the plaintext: the created user can log in with `Passw0rd!` and the API response never contains the password or hash.

### `GET /api/auth/me`
- **Happy path**:
  - `A-028` With `MGR` → 200, `{ id, email: "manager@demo", role: "manager" }`, no `passwordHash`.
  - `A-029` With `CLK` → 200 with `role: "clerk"`.
- **Validation failures**:
  - `A-030` `Authorization: Bearer <syntactically-valid-JWT-signed-with-wrong-secret>` → 401 shape (not 500).
- **Auth failures**:
  - `A-031` No `Authorization` header → 401 shape.
  - `A-032` Expired token (JWT with `exp` in the past, signed with the real secret) → 401 shape.
- **Idempotency / edge cases**:
  - `A-033` Token whose `sub` references a user id that no longer exists → 401 shape, not 200-with-null and not 500.

### `GET /api/items`
- **Happy path**:
  - `A-034` With `CLK` → 200. Body is a paginated envelope (`{ data: Item[], total, page, pageSize }` or the shape `service_agent` fixes in `models.ts` — assert the same shape the frontend consumes). Each row has `id, sku, name, unit, reorderAt, totalOnHand`, and `totalOnHand` is a number ≥ 0.
  - `A-035` With `MGR` → 200 with the same shape (clerk and manager both read the catalog).
  - `A-036` `?q=SKU-001` → 200 with only rows whose `sku` or `name` contains `SKU-001`; `?q=sku-001` (lowercase) returns the same rows, proving case-insensitive matching.
  - `A-037` `?lowStock=true` → 200; every returned row satisfies `totalOnHand <= reorderAt`, and every seeded item with `totalOnHand > reorderAt` is absent.
  - `A-038` `?page=1&pageSize=2` → at most 2 rows and a `total` equal to the unpaginated count; `?page=2&pageSize=2` returns a disjoint set of ids.
- **Validation failures**:
  - `A-039` `?page=0` or `?page=-1` → 400 (or clamps to page 1 — assert the implemented behaviour, never a 500 or an empty page for a valid dataset).
  - `A-040` `?pageSize=abc` → 400.
  - `A-041` `?pageSize=100000` → 400 or clamped to a documented max; the response must not attempt to return the whole table unbounded.
  - `A-042` `?lowStock=notabool` → 400 or treated as false; never a 500.
- **Auth failures**:
  - `A-043` No token → 401 shape.
- **Idempotency / edge cases**:
  - `A-044` `?q=` (empty) behaves as no filter, returning the same count as an unfiltered request.
  - `A-045` `?q=zzz-no-such-sku` → 200 with an empty `data` array and `total: 0` (not 404).
  - `A-046` An item with zero `StockLevel` rows appears with `totalOnHand === 0` (not omitted, not `null`).
  - `A-047` `?q=SKU-001&lowStock=true&page=1&pageSize=5` — filters compose; result is the intersection, not the union.

### `GET /api/items/:id`
- **Happy path**:
  - `A-048` With `CLK` and a seeded item id → 200 with `{ id, sku, name, description, unit, reorderAt, stockLevels: [...] }`; each `stockLevels` entry includes `qty` and a nested `location` with `id`, `name`, `zone`.
  - `A-049` For a two-location fixture (`Zone A: 20`, `Zone B: 10`) → `stockLevels` has 2 entries and `sum(qty) === 30`, matching `totalOnHand` from `GET /api/items` for the same id.
- **Validation failures**:
  - `A-050` `GET /api/items/not-a-real-id` → 404 (not 500, not 200-with-null).
- **Auth failures**:
  - `A-051` No token → 401 shape.
- **Idempotency / edge cases**:
  - `A-052` An item never stocked anywhere → 200 with `stockLevels: []`; sum of an empty breakdown is treated as 0 by the caller.
  - `A-053` Repeated GETs with no intervening mutation return byte-identical `stockLevels` content (ordering is stable/deterministic).

### `GET /api/items/:id/movements`
- **Happy path**:
  - `A-054` With `CLK` (this route is deliberately clerk-accessible, unlike `GET /api/movements`) → 200, a list of movements for that item only, ordered `createdAt` descending, each entry carrying `type`, `qty`, `createdAt`, `user.email`, and `fromLoc`/`toLoc` (null where the type doesn't use one).
  - `A-055` With `MGR` → 200, same content.
- **Validation failures**:
  - `A-056` Unknown item id → 404 (not an empty 200, since that hides typos).
- **Auth failures**:
  - `A-057` No token → 401 shape.
- **Idempotency / edge cases**:
  - `A-058` After a `TRANSFER` of the item between `Zone A` and `Zone B`, the transfer appears exactly once in this list (not once per affected location).
  - `A-059` Movements of *other* items never leak into the list: create movements for two items, assert every returned row has the requested `itemId`.

### `POST /api/items`
- **Happy path**:
  - `A-060` `MGR` posts `{ sku: "SKU-TEST-1", name: "Widget", unit: "ea", reorderAt: 10, description: "x" }` → 201 with the persisted row including a generated `id`; a follow-up `GET /api/items?q=SKU-TEST-1` returns exactly 1 row.
- **Validation failures**:
  - `A-061` Missing `sku` → 400.
  - `A-062` `reorderAt: -1` → 400 (thresholds are non-negative integers).
  - `A-063` `reorderAt: "ten"` → 400 (and `reorderAt: "10"` is coerced to the number 10 by `transform: true`, or rejected — assert one, consistently).
  - `A-064` `{ sku: "", name: "", unit: "" }` → 400 listing all three fields.
  - `A-065` Unknown property `{ ..., totalOnHand: 999 }` → stripped by `whitelist: true`; the created item's computed `totalOnHand` is 0.
- **Auth failures**:
  - `A-066` No token → 401 shape.
  - `A-067` `CLK` → 403 shape, and `GET /api/items?q=<attempted sku>` returns 0 rows (the 403 blocked the write, not just the response).
- **Idempotency / edge cases**:
  - `A-068` Posting `SKU-001` (already seeded) → 409 with a field-level message naming `sku`, and `GET /api/items?q=SKU-001` still returns **exactly one** row.
  - `A-069` Two concurrent POSTs of the same new sku → exactly one 201 and one 409; the table holds one row (Prisma `P2002` is mapped, never surfaced as a 500).

### `PATCH /api/items/:id`
- **Happy path**:
  - `A-070` `MGR` patches `{ name: "Renamed", reorderAt: 25 }` → 200 with the updated fields; a follow-up GET reflects both, and `sku` is unchanged.
  - `A-071` Partial patch `{ reorderAt: 5 }` leaves `name`, `unit`, `description` untouched.
- **Validation failures**:
  - `A-072` `{ reorderAt: -5 }` → 400 and the stored value is unchanged.
  - `A-073` Unknown item id → 404.
  - `A-074` `{}` → 200 no-op or 400 — assert the implemented choice; must not blank out fields.
- **Auth failures**:
  - `A-075` No token → 401 shape.
  - `A-076` `CLK` → 403 shape and the item is unmodified on a follow-up GET.
- **Idempotency / edge cases**:
  - `A-077` Patching `sku` to another existing item's sku → 409, and both items keep their original skus.
  - `A-078` Applying the same patch twice yields the same final state (idempotent).
  - `A-079` Raising `reorderAt` above `totalOnHand` makes the item appear in `?lowStock=true` and in `/api/reports/low-stock` on the next read — no cached/stale threshold.

### `DELETE /api/items/:id`
- **Happy path**:
  - `A-080` `MGR` deletes a freshly created item with no `StockLevel` rows and no `Movement` rows → 200/204; a follow-up `GET /api/items/:id` → 404.
- **Validation failures**:
  - `A-081` Unknown id → 404.
- **Auth failures**:
  - `A-082` No token → 401 shape.
  - `A-083` `CLK` → 403 shape and the item still exists.
- **Idempotency / edge cases**:
  - `A-084` Deleting an item with a non-zero `StockLevel` → 409 with a message explaining the block; the item and its stock rows still exist.
  - `A-085` Deleting an item referenced by any `Movement` (even with all balances now zero) → 409; the audit log row survives.
  - `A-086` Second DELETE of an already-deleted id → 404 (not 500).

### `GET /api/locations`
- **Happy path**:
  - `A-087` With `CLK` → 200 with `Zone A`, `Zone B`, `Zone C`, each `{ id, name, zone }` (clerks need this to populate the movement wizard's selects).
  - `A-088` With `MGR` → 200, same rows.
  - `A-089` `?q=Zone A` → 200 filtered to matching names.
- **Validation failures**:
  - `A-090` `?q=` empty → unfiltered list, not an error.
- **Auth failures**:
  - `A-091` No token → 401 shape.
- **Idempotency / edge cases**:
  - `A-092` If the payload includes a "distinct items stocked" count (used by the locations list screen), it equals `COUNT(DISTINCT itemId) WHERE qty > 0` for that location — verified by seeding a known two-item location.

### `POST /api/locations`
- **Happy path**:
  - `A-093` `MGR` posts `{ name: "Zone D", zone: "D" }` → 201 with an id; it appears in a follow-up `GET /api/locations`.
- **Validation failures**:
  - `A-094` `{ name: "" }` → 400.
  - `A-095` Missing `zone` → 400.
- **Auth failures**:
  - `A-096` No token → 401 shape.
  - `A-097` `CLK` → 403 shape and no location is created.
- **Idempotency / edge cases**:
  - `A-098` Posting `Zone A` (duplicate name) → 409, and `GET /api/locations` still shows exactly one `Zone A`.

### `PATCH /api/locations/:id`
- **Happy path**:
  - `A-099` `MGR` patches `{ zone: "D2" }` → 200 with the update reflected on a follow-up GET; existing `StockLevel` rows for that location are untouched (quantities unchanged).
- **Validation failures**:
  - `A-100` Unknown id → 404.
  - `A-101` `{ name: "" }` → 400.
- **Auth failures**:
  - `A-102` No token → 401 shape.
  - `A-103` `CLK` → 403 shape, location unmodified.
- **Idempotency / edge cases**:
  - `A-104` Renaming to an existing location's name → 409; both keep their original names.

### `DELETE /api/locations/:id`
- **Happy path**:
  - `A-105` `MGR` deletes a location with no stock and no movements → 200/204 and it disappears from `GET /api/locations`.
- **Validation failures**:
  - `A-106` Unknown id → 404.
- **Auth failures**:
  - `A-107` No token → 401 shape.
  - `A-108` `CLK` → 403 shape, location still present.
- **Idempotency / edge cases**:
  - `A-109` Deleting a location holding non-zero stock → 409 and the `StockLevel` rows survive.
  - `A-110` Deleting a location referenced as `fromLoc` or `toLoc` by any `Movement` → 409; the audit log stays referentially intact.

### `POST /api/movements`
- **Happy path**:
  - `A-111` **IN**: `CLK` posts `{ type: "IN", itemId: WIDGET, toLocId: ZoneA, qty: 50 }` against a 0 balance → 201; response includes the movement (with `userId` = the clerk's id) and the affected balance; `GET /api/items/:id` shows `Zone A: 50`.
  - `A-112` **OUT**: `{ type: "OUT", itemId: WIDGET, fromLocId: ZoneA, qty: 20 }` against 50 → 201 and `Zone A: 30`.
  - `A-113` **TRANSFER**: `{ type: "TRANSFER", itemId: WIDGET, fromLocId: ZoneA, toLocId: ZoneB, qty: 10 }` against `A:30 / B:0` → 201 and `A:20 / B:10`; `totalOnHand` is conserved at 30 before and after.
  - `A-114` `MGR` can also record movements (not clerk-only) → 201.
  - `A-115` The recorded `Movement.userId` is taken from the JWT, not the body: posting `{ ..., userId: <other user id> }` still attributes the row to the caller.
- **Validation failures**:
  - `A-116` `IN` with `fromLocId` set and no `toLocId` → 400.
  - `A-117` `OUT` with `toLocId` set and no `fromLocId` → 400.
  - `A-118` `TRANSFER` missing `toLocId` → 400.
  - `A-119` `TRANSFER` with `fromLocId === toLocId` → 400.
  - `A-120` `qty: 0` → 400; `qty: -5` → 400; `qty: 1.5` → 400 (integers ≥ 1 only).
  - `A-121` `type: "ADJUST"` (not in the enum) → 400.
  - `A-122` Unknown `itemId` → 404; unknown `fromLocId`/`toLocId` → 404 (distinct from the 400 shape errors above).
  - `A-123` **Insufficient stock**: `OUT` of 10 against a balance of 5 → 400 with an `Insufficient stock` message, **and a follow-up `GET /api/items/:id` still reads 5** — assert the rollback, not just the status code.
  - `A-124` `TRANSFER` of more than the source holds → 400 and *neither* side moves: source unchanged and destination unchanged (the credit must not survive the failed debit).
- **Auth failures**:
  - `A-125` No token → 401 shape, and no `Movement` row is written.
- **Idempotency / edge cases**:
  - `A-126` **Concurrency**: fire two simultaneous `OUT` of 30 against a balance of 50 → exactly one 201 and one 400; the final balance is exactly 20 and never negative; the failing response is a 400, never a 500 leaking Prisma `P2034`.
  - `A-127` `OUT` of exactly the full balance (30 against 30) → 201 and the balance lands at exactly 0 (the guard is `qty >= dto.qty`, not `>`).
  - `A-128` `IN` to a location with no existing `StockLevel` row creates one via upsert (no 500 on the missing row).
  - `A-129` Two identical `IN` posts of 10 are **not** deduplicated — both are recorded and the balance rises by 20 (movements are an append-only log, not idempotent by payload).
  - `A-130` Every successful movement writes exactly one `Movement` row; every rejected movement writes zero.

### `GET /api/movements`
- **Happy path**:
  - `A-131` `MGR` → 200, paginated, ordered `createdAt` descending, each row carrying `createdAt`, `user.email`, `item`, `type`, `qty`, `fromLoc`, `toLoc`, `note`.
- **Validation failures**:
  - `A-132` `?type=NONSENSE` → 400.
  - `A-133` `?from=not-a-date` → 400.
  - `A-134` `?from=2026-12-31&to=2026-01-01` (inverted range) → 400 or an empty result set — never a 500.
  - `A-135` `?page=0` → 400 or clamped, consistent with `A-039`.
- **Auth failures**:
  - `A-136` No token → 401 shape.
  - `A-137` `CLK` → **403** shape (explicitly not 401 — the two must never be conflated).
- **Idempotency / edge cases**:
  - `A-138` `?itemId=` filters to that item only; `?type=OUT` returns only `OUT` rows; `?locationId=ZoneA` returns rows where `Zone A` is either `fromLoc` or `toLoc`; combining `?itemId=&type=` intersects.
  - `A-139` `?from`/`?to` boundaries are inclusive of a movement created exactly at `from` (assert with a fixed, seeded timestamp).

### `GET /api/reports/low-stock`
- **Happy path**:
  - `A-140` `MGR` → 200, rows of `{ item, totalOnHand, reorderAt, shortfall }` ordered by `shortfall` descending; non-empty on a freshly seeded DB.
- **Validation failures**:
  - `A-141` Unknown query params are ignored, not 500 (endpoint takes no required input).
- **Auth failures**:
  - `A-142` No token → 401 shape.
  - `A-143` `CLK` → 403 shape.
- **Idempotency / edge cases**:
  - `A-144` **Boundary**: item with `reorderAt 10` and 12 on hand is **absent**; after an `OUT` of 2 (`totalOnHand === reorderAt === 10`) it is **present** (predicate is `<=`); after a further `OUT` of 5 it is still present with `shortfall: 5`.
  - `A-145` An item with 40 on hand and `reorderAt 10` is absent throughout.
  - `A-146` An item with **no `StockLevel` rows at all** is listed with `totalOnHand: 0` and `shortfall === reorderAt` (`COALESCE(SUM(qty),0)`).
  - `A-147` Stock is summed **across all locations**: an item with `Zone A: 6` + `Zone B: 6` and `reorderAt 10` is absent (12 > 10) even though each location alone is below threshold.

### `GET /api/admin/settings`
> Not in the product spec; added by `tasks.md` to back the provisioned `postgresql` / `minio` services.
- **Happy path**:
  - `A-148` `MGR` → 200, one entry per credential key for `postgresql` and `minio`, each with a masked value and a configured/unconfigured status flag.
- **Validation failures**:
  - `A-149` Response never returns a raw secret: for a key set to a known value, the returned value is masked (e.g. `••••1234`) and does not equal the plaintext.
- **Auth failures**:
  - `A-150` No token → 401 shape.
  - `A-151` `CLK` → 403 shape.
- **Idempotency / edge cases**:
  - `A-152` A key whose env value is absent, or equals the `PLACEHOLDER_CONFIGURE_IN_SETTINGS` sentinel, reports status `unconfigured`; a key backed by a real `SystemSetting` row reports `configured`.

### `PATCH /api/admin/settings`
- **Happy path**:
  - `A-153` `MGR` patches `{ MINIO_ACCESS_KEY: "abc123" }` → 200; a follow-up `GET /api/admin/settings` reports that key as `configured` with a masked value.
- **Validation failures**:
  - `A-154` Empty body `{}` → 400 or 200 no-op — assert the implemented choice; never a 500.
  - `A-155` A non-string value (`{ MINIO_ACCESS_KEY: 42 }`) → 400 or coerced to a string, consistently.
- **Auth failures**:
  - `A-156` No token → 401 shape.
  - `A-157` `CLK` → 403 shape and the `SystemSetting` row is unchanged.
- **Idempotency / edge cases**:
  - `A-158` Patching the same key twice leaves exactly one `SystemSetting` row (upsert on the `key` primary key), with `updatedAt` advanced.
  - `A-159` A consumer calling `resolveConfig` for a still-unconfigured key surfaces as HTTP **503** (`ServiceUnconfiguredError`), not 500. Skipped if no endpoint consumes an unconfigured key.

### `GET /trpc/users.findAll` — retired scaffold route
- **Happy path**: none — this route must not exist after the REST migration.
- **Validation failures**:
  - `A-160` `GET /trpc/users.findAll` → 404. The demo tRPC router (`backend/src/users/users.router.ts`, `backend/src/trpc/*`) and `frontend/src/app/trpc-client.types.ts` are retired per the `tasks.md` decision.
- **Auth failures**: n/a (route removed).
- **Idempotency / edge cases**:
  - `A-161` No route under `/trpc` responds 2xx (assert on the base path too), and `.pipeline/surface.json` no longer lists it once `ui_agent` rewrites the manifest.

### `GET /trpc/users.findById` — retired scaffold route
- **Happy path**: none — route must not exist.
- **Validation failures**:
  - `A-162` `GET /trpc/users.findById?input=...` → 404.
- **Auth failures**: n/a (route removed).
- **Idempotency / edge cases**:
  - `A-163` The Angular app makes zero network requests to `/trpc/*` on any route (assert via a Playwright request interceptor across `/login` and `/items`).

## UI / journey tests

All journeys use `data-testid` selectors (`ui_agent` is tasked with adding them to every table, form control,
badge, and nav link). `MGR-UI` = logged in as `manager@demo`, `CLK-UI` = as `clerk@demo`, password `Demo1234!`.

### Journey: Unauthenticated smoke (deploy oracle)
- **Steps**: `docker compose up` → open `/` in a fresh browser context with empty `localStorage`.
- **Expected outcomes**:
  - `J-001` The app redirects `/` → `/items` → `/login?returnUrl=%2Fitems` (the `authGuard` bounce), and the URL settles on `/login`.
  - `J-002` The **rendered body text** contains the literal `StockRoom` — on the login page itself, not only in `<title>` or the authenticated shell. This is the Playwright/Colossus oracle; `.colossus-acceptance.json` `expect_text` must list `StockRoom`.
  - `J-003` The ready container carries `data-testid="app-ready"` (the acceptance manifest's `ready_testid`).
  - `J-004` None of the `reject_signatures` from `.colossus-acceptance.json` appear: no `home-title">Users<`, no stuck `Loading...`, no `Failed to load users.`.
  - `J-005` `<title>` is `StockRoom`.
  - `J-006` A demo-credentials hint is visible on the login page.
- **Negative path**:
  - `J-007` With the backend stopped, the login page still renders `StockRoom` (the SPA shell must not depend on an API call to paint), and submitting shows a readable connection error rather than a blank page or an unhandled console rejection.

### Journey: Login and logout
- **Steps**: `/login` → type `manager@demo` / `Demo1234!` → submit → observe `/items` → click logout.
- **Expected outcomes**:
  - `J-008` On success the URL becomes `/items`, the item table renders, and a token is present in `localStorage`.
  - `J-009` Logging in from `/login?returnUrl=%2Freports%2Flow-stock` lands on `/reports/low-stock`, not `/items`.
  - `J-010` Logout clears the token from `localStorage`, routes to `/login`, and pressing Back does not restore an authenticated view (a re-guarded route bounces to `/login`).
  - `J-011` After login, requests carry `Authorization: Bearer <token>` (assert via a request interceptor).
- **Negative path**:
  - `J-012` Wrong password → stays on `/login`, shows an inline error, does not write a token to `localStorage`.
  - `J-013` With a hand-corrupted `localStorage` token, loading `/items` triggers a 401 → the interceptor clears state and redirects to `/login?returnUrl=%2Fitems` (no infinite redirect loop; assert at most one navigation cycle).

### Journey: Signup
- **Steps**: `/login` → follow the signup link → `/signup` → enter a new email + password → submit.
- **Expected outcomes**:
  - `J-014` Success lands the new user on `/items` as a **clerk** on a seeded deploy: manager-only nav entries (Movement log, Low stock, Admin settings) are absent.
  - `J-015` `/signup` is reachable unauthenticated (no guard bounce) and renders the `StockRoom` wordmark.
- **Negative path**:
  - `J-016` Signing up with `manager@demo` shows the 409 as a readable inline error on the email field, and the user stays on `/signup` unauthenticated.
  - `J-017` Client-side validation blocks submit on an invalid email / empty password, with a visible field message.

### Journey: Browse and filter the item catalog
- **Steps**: `CLK-UI` → `/items` → type `SKU-001` in the search box → toggle the low-stock filter → page forward.
- **Expected outcomes**:
  - `J-018` The table shows sku, name, unit, reorder threshold, and total on hand for each row.
  - `J-019` Typing in search updates the URL to `/items?q=SKU-001`; toggling low stock updates it to include `lowStock=true`; paging adds `page=2`. Reloading the resulting URL in a fresh tab reproduces the exact same filtered view.
  - `J-020` Rows where `totalOnHand <= reorderAt` render a visible low-stock badge; rows above threshold do not.
  - `J-021` A loading state is visible while the request is in flight and is replaced by data (never a permanently stuck spinner).
- **Negative path**:
  - `J-022` A search with no matches shows an explicit empty state, not a blank table or an error.
  - `J-023` With the API returning 500, an error state is rendered with a retry affordance.

### Journey: Item detail — per-location breakdown and movement history
- **Steps**: `CLK-UI` → `/items` → click a two-location item → observe tabs → switch to the Movements tab.
- **Expected outcomes**:
  - `J-024` `/items/:id` redirects to `/items/:id/locations`.
  - `J-025` The locations tab lists one row per location with its `qty` and a summed footer whose **displayed** value equals the `totalOnHand` shown for that item on `/items` (assert the rendered numbers, not just the API).
  - `J-026` `/items/:id/movements` shows that item's history: timestamp, type, qty, from → to, user email.
  - `J-027` Both tabs are directly deep-linkable in a fresh tab (after login) and each restores its own tab state.
- **Negative path**:
  - `J-028` `/items/does-not-exist/locations` renders a not-found state, not a crash or an infinite spinner.
  - `J-029` An item with no stock anywhere shows an empty breakdown with a footer total of 0.

### Journey: Manager creates and edits an item
- **Steps**: `MGR-UI` → `/items` → "New item" → fill sku/name/unit/reorderAt → save → reopen via `/items/:id/edit` → change name → save.
- **Expected outcomes**:
  - `J-030` Create lands back on the list (or the new item's detail) with the item visible.
  - `J-031` Edit persists: reloading `/items/:id/locations` shows the new name.
  - `J-032` `/items/new` and `/items/:id/edit` are reachable only via manager-guarded routes and render prefilled values on edit.
- **Negative path**:
  - `J-033` Submitting a duplicate `SKU-001` surfaces the server's 409 as an **inline field error on `sku`** (not a toast, not a swallowed failure), the form stays open with entered values intact, and no second item is created.
  - `J-034` Client-side validation blocks a negative `reorderAt` before submit.

### Journey: Manager deletes an item (blocked and allowed)
- **Steps**: `MGR-UI` → delete a seeded item that has stock/movements → then delete a freshly created untouched item.
- **Expected outcomes**:
  - `J-035` The unreferenced item deletes and disappears from `/items`.
- **Negative path**:
  - `J-036` The referenced item's delete shows a clear, human-readable explanation of the 409 (audit integrity), the item remains in the list, and the failure is never silent.

### Journey: Locations list and manager CRUD
- **Steps**: `CLK-UI` → `/locations`; then `MGR-UI` → `/locations/new` → create `Zone D` → `/locations/:id/edit` → rename.
- **Expected outcomes**:
  - `J-037` Clerks can view `/locations` (name, zone, distinct items stocked) but see no create/edit affordances.
  - `J-038` `?q=` search is bound to the URL and the filtered list is linkable.
  - `J-039` Manager create/edit persist and are visible on reload.
- **Negative path**:
  - `J-040` Creating a duplicate `Zone A` shows the 409 as an inline error on `name`.
  - `J-041` Deleting a location that holds stock shows the 409 explanation and the location stays in the list.
  - `J-042` A clerk deep-linking to `/locations/new` is redirected to `/items` (roleGuard), not to `/login`.

### Journey: Record a movement (3-step wizard)
- **Steps**: `CLK-UI` → `/movements/new` → step 1 pick item → step 2 pick `TRANSFER` + from `Zone A` / to `Zone B` → step 3 enter qty + note → confirm.
- **Expected outcomes**:
  - `J-043` The URL tracks the step (`?step=1` → `?step=2` → `?step=3`) and the browser Back button returns to the previous step with prior selections intact.
  - `J-044` Step 2's location selects switch on type: `IN` shows destination only, `OUT` shows source only, `TRANSFER` shows both.
  - `J-045` Step 3 displays the current balance at the selected source location.
  - `J-046` On success the app routes to the item detail, where the per-location breakdown reflects the new balances immediately.
  - `J-047` Deep-linking `/movements/new?step=3` in a fresh tab restores the wizard at step 3 (or degrades to the earliest step still missing required input) rather than dumping the user at `/items`.
- **Negative path**:
  - `J-048` `TRANSFER` with identical from/to locations is rejected client-side with a visible message and the submit is blocked.
  - `J-049` A qty above the source balance is flagged client-side; if submitted anyway (e.g. the balance changed under the user), the server's 400 `Insufficient stock` is displayed as the **authoritative** error and the wizard stays on step 3 with input preserved.
  - `J-050` `qty` of 0 or a negative number is blocked before submit.

### Journey: Manager reads the movement audit log
- **Steps**: `MGR-UI` → `/movements` → filter by item, then by type `OUT`, then by date range.
- **Expected outcomes**:
  - `J-051` The table shows timestamp, user email, item, type, qty, from → to, and note, newest first.
  - `J-052` Each filter writes to query params (`?itemId=&type=OUT&from=&to=&page=`) and drives the request; reloading the URL reproduces the filtered log.
  - `J-053` A movement just recorded by the clerk journey appears attributed to `clerk@demo`.
- **Negative path**:
  - `J-054` A filter combination with no results shows an empty state, not an error.
  - `J-055` A clerk navigating to `/movements` is redirected to `/items` by `roleGuard` (not bounced to `/login`, and never shown log data).

### Journey: Manager reads the low-stock report
- **Steps**: `MGR-UI` → `/reports/low-stock` → click a row through to the item.
- **Expected outcomes**:
  - `J-056` The report is non-empty on a fresh seeded deploy and shows item, on hand, reorderAt, and shortfall.
  - `J-057` Rows link to the item detail and the link navigates correctly.
  - `J-058` After recording an `OUT` that drops an item to exactly its `reorderAt`, that item appears on the next load of the report (boundary is inclusive, matching `A-144`).
- **Negative path**:
  - `J-059` If nothing is below threshold, an explicit empty state is shown ("no items below threshold"), not a blank page.
  - `J-060` A clerk deep-linking `/reports/low-stock` is redirected to `/items`.

### Journey: Manager configures admin settings
> Not in the product spec; from the `tasks.md` decomposition.
- **Steps**: `MGR-UI` → `/admin/settings` → inspect the `postgresql` and `minio` sections → enter a MinIO credential → save.
- **Expected outcomes**:
  - `J-061` One section per provisioned service, each with a configured/unconfigured badge.
  - `J-062` A banner lists anything still needing credentials ("The following need credentials to activate: …") and disappears once all keys are configured.
  - `J-063` Saving persists: reload shows the key as configured with a masked value, and the plaintext secret is never rendered.
- **Negative path**:
  - `J-064` A clerk deep-linking `/admin/settings` is redirected to `/items`.
  - `J-065` A failed save surfaces a readable error and does not falsely flip the badge to configured.

### Journey: Role-aware navigation
- **Steps**: log in as each seeded account and compare the shell nav.
- **Expected outcomes**:
  - `J-066` `MGR-UI` sees nav entries for Items, Locations, Record movement, **Movement log, Low stock, Admin settings**.
  - `J-067` `CLK-UI` sees Items, Locations, Record movement and **none** of the three manager entries.
  - `J-068` The `StockRoom` wordmark and a logout control are present in the shell for both roles.
- **Negative path**:
  - `J-069` Hiding nav is not the only defence: a clerk hitting each manager route directly is redirected to `/items`, and the corresponding API call (if forced) returns 403 — assert both layers.

### Journey: Deep-link restoration after login
- **Steps**: in a fresh tab with empty `localStorage`, open each of `/items/:id/movements`, `/movements/new?step=3`, and `/movements?type=OUT`; log in when bounced.
- **Expected outcomes**:
  - `J-070` Each bounces to `/login?returnUrl=<the original path **and** query string, encoded>`.
  - `J-071` After a manager logs in, each lands on the originally requested URL with its query params intact — not `/items`.
  - `J-072` `/movements?type=OUT` arrives with the type filter already applied to the rendered table.
- **Negative path**:
  - `J-073` For `/movements?type=OUT`, a **clerk** login redirects to `/items` (roleGuard beats returnUrl) without ever flashing log data.
  - `J-074` An unknown path (`/nonsense`) redirects to `/items` when authenticated, and to `/login` when not.

## Data integrity tests

- `D-001` **Conservation under TRANSFER**: for any item, `SUM(StockLevel.qty)` is identical before and after a `TRANSFER`, and the two affected rows change by exactly `-qty` / `+qty`.
- `D-002` **Never negative**: no `StockLevel.qty` is ever `< 0` after any sequence of movements, including the concurrency case in `A-126`. Assert with a table-wide `SELECT count(*) FROM "StockLevel" WHERE qty < 0` = 0 at the end of every mutation suite.
- `D-003` **Rollback completeness**: after a rejected movement (400 or 404), `SELECT count(*) FROM "Movement"` is unchanged **and** every `StockLevel` row for that item is byte-identical to a pre-request snapshot.
- `D-004` **Breakdown equals total**: for every item, `SUM(StockLevel.qty)` equals the `totalOnHand` returned by `GET /api/items` and the sum of `stockLevels[].qty` returned by `GET /api/items/:id`. Assert across all 8 seeded items, not just one.
- `D-005` **Ledger reconstructs balances**: replaying every `Movement` row in `createdAt` order (`IN` credits `toLoc`, `OUT` debits `fromLoc`, `TRANSFER` does both) reproduces the exact current `StockLevel` table.
- `D-006` **Movement shape matches type**: no row has `type='IN'` with a non-null `fromLocId`, `type='OUT'` with a non-null `toLocId`, or `type='TRANSFER'` with a null `fromLocId`/`toLocId` or `fromLocId = toLocId`. Enforced as a post-suite query over the whole table.
- `D-007` **Positive quantities**: `SELECT count(*) FROM "Movement" WHERE qty < 1` = 0.
- `D-008` **Attribution**: every `Movement.userId` references an existing `User`, and equals the id of the JWT subject that issued the request (spot-checked per movement created in the API suites).
- `D-009` **Uniqueness**: `@@unique([itemId, locationId])` holds — no duplicate `StockLevel` pairs after concurrent `IN` upserts to the same pair (fire 5 concurrent `IN`s, assert one row whose qty equals the sum).
- `D-010` **Catalog uniqueness**: `Item.sku` and `Location.name` and `User.email` each have zero duplicates after the duplicate-creation attempts in `A-068`, `A-098`, `A-026`.
- `D-011` **Referential integrity of the audit log**: every `Movement.itemId` / `fromLocId` / `toLocId` resolves to an existing row — guaranteed by the 409 delete blocks (`A-084`, `A-085`, `A-109`, `A-110`). Assert with left-join orphan queries returning 0 rows.
- `D-012` **Password storage**: `SELECT passwordHash FROM "User"` — every value starts with a bcrypt prefix (`$2a$`/`$2b$`), none equals a known plaintext, and no API response body anywhere in the suite contains the substring `passwordHash`.
- `D-013` **Seed idempotency**: running the seed twice leaves the same row counts for `User`, `Item`, `Location`, and does not duplicate opening `IN` movements or double the balances.
- `D-014` **Seed preconditions hold**: after a fresh seed, `GET /api/reports/low-stock` is non-empty (≥ 2 items) and `GET /api/movements` is non-empty — the demo surfaces are never blank on a fresh deploy.
- `D-015` **Schema migration cleanliness**: `prisma migrate deploy` on an empty database succeeds and `prisma migrate status` reports no drift; no scaffolded tRPC-era demo models remain in `schema.prisma`.

## Out of scope

- **Session cookies / refresh tokens / password reset / email verification.** The spec pins JWT bearer with a 12h expiry and client-side logout; nothing else is specified. Token *expiry* is tested (`A-032`) but silent renewal is not, because no refresh mechanism exists.
- **The two scaffolded tRPC routes as functioning endpoints.** `GET /trpc/users.findAll` and `GET /trpc/users.findById` are in `surface.json` only because the manifest is stale. They are tested for **absence** (`A-160`–`A-163`) rather than behaviour, per the REST decision recorded in `tasks.md`.
- **MinIO storage behaviour.** MinIO is provisioned but the spec declares no upload, attachment, or export feature. Only its credential entries on `/admin/settings` are covered; no bucket, upload, or signed-URL tests.
- **Third-party integrations.** The spec states "Integrations: None" and the pipeline carries only a `NONE_API_KEY` sentinel. No integration client tests.
- **Multi-tenancy / organisation scoping.** The app is explicitly single-tenant; no cross-tenant isolation tests.
- **Stock adjustments, cycle counts, negative-stock overrides, and movement edit/delete.** The spec defines exactly three movement types and an append-only log; there is no API to correct a mistaken movement, so no such tests exist. Flagged as a likely follow-up product gap.
- **Soft delete / restore.** Deletes are hard, and blocked by 409 when referenced. No archive/restore surface exists.
- **Accessibility, i18n, responsive breakpoints, and visual regression.** The spec is silent on all four. Journeys assert visible text and testIds, not contrast ratios, screen-reader semantics, locales, or pixel layout.
- **Performance and load characteristics** beyond the single concurrency invariant (`A-126`). No throughput, latency budget, or dataset-scale testing is specified; pagination caps are asserted for correctness only (`A-041`).
- **Rate limiting / brute-force protection on `/api/auth/login`.** Not specified. `A-015`/`A-016` cover the 401 path only. Flagged as a security gap worth raising.
- **CORS behaviour in production.** The scaffold serves the SPA through nginx on the same origin; only the dev-proxy origin is configured. No cross-origin matrix is tested.
- **The spec's `api/`+`web/` single-container Dockerfile, `useStaticAssets`, and SPA-fallback middleware.** The scaffold uses `backend/` + `frontend/` with nginx `spa-fallback` (`colossus.yaml`). Deep-link handling is still tested — through the nginx path, in the deep-link journey (`J-070`–`J-074`).
- **Angular version drift (spec says 17, scaffold is 19)** and the build output path. Covered indirectly by the smoke journey: if `dist/frontend/browser` is wrong, `J-002` fails with a blank page.
