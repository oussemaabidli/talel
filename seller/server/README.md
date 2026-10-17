# Talel Shared API

Node.js, Express, TypeScript, Prisma, and PostgreSQL API shared by the Client, Seller, and Host portals.

## Prerequisites

- Node.js 20.19+ or 22.12+
- PostgreSQL 15+
- PowerShell

## Configure PostgreSQL

Create a local database (for a standard local PostgreSQL installation):

```powershell
createdb talel_seller
```

Copy `.env.example` to `.env` in this folder and set `DATABASE_URL`, a random `COOKIE_SECRET` with at least 32 characters, and `APP_ORIGINS` for the portals you run (Client 3001, Seller 3002, Host 3003 by default). The Client dev server uses strict port 3001 and stops with an error if it is occupied. `OFFER_EXPIRY_DAYS` defaults to 7 and `OFFER_EXPIRY_REMINDER_HOURS` defaults to 24; the reminder must occur before expiry. `PRIVATE_DOCUMENTS_DIR` is resolved relative to this `server/` directory; keep it outside static/public directories and do not commit its contents. Do not commit `.env`.

```powershell
Copy-Item .env.example .env
```

The database URL example is `postgresql://postgres:postgres@localhost:5432/talel_seller?schema=public`. Change the username and password to match your local PostgreSQL setup.

## Install and run

From the `seller` directory:

```powershell
npm install
npm run server:install
Copy-Item server/.env.example server/.env
npm run server:db:deploy
npm run server:dev
```

In another PowerShell window, run the Seller frontend:

```powershell
Copy-Item .env.example .env.local
npm run dev
```

The API listens on `http://localhost:4000`; the Vite Seller app listens on `http://localhost:3002`. Set `VITE_API_BASE_URL` in `.env.local` to the API base if it differs. `/health` is a database-independent health check.

## Database migrations

The initial migration is in `server/prisma/migrations/20261015120000_init`. Apply it to the configured database with `npm run server:db:deploy` from the Seller root. Create future development migrations from `server/` with `npm run db:migrate -- --name describe_change`. Reset a disposable local development database from `server/` with `npx prisma migrate reset`; this destroys all records in that database. Never run that command against shared or production data.

The current environment did not provide a PostgreSQL service, so the migration has been generated from the Prisma schema but not applied here.

Synthetic request fixtures are optional and guarded. In PowerShell, set `$env:ALLOW_DEMO_FIXTURES = 'true'`, run `npm run server:seed` from the Seller root, then clear the variable with `Remove-Item Env:ALLOW_DEMO_FIXTURES`. The sample rows are labeled development examples and are never seeded automatically.

## Client API

Client auth is namespaced under `/api/v1/client/auth` and uses the shared HTTP-only session cookie with explicit `CLIENT` role checks. Registration never accepts a role. Client routes include profile update, owner-scoped request create/list/detail/edit/cancel, owner-scoped offers and atomic acceptance/rejection, order list/detail, participant-scoped conversations/messages, and per-user notifications. Client data is not returned by Seller endpoints. Requests linked to existing legacy rows may still have a null `clientId`; new Client-created requests always use the authenticated user ID.

Apply the additive Client image and request-lifecycle migrations with `npm run server:db:deploy` after reviewing the configured database target. This repository change does not apply migrations automatically. Client request images are stored privately, linked transactionally to their request, and read only through authorized API routes. Each image is limited to 5 MiB and each request to five images. Offer expiry/reminder timestamps preserve historical rows; selecting an offer creates a provisional order while other pending offers remain available. Competing offers close when fulfillment begins. Cancelling a provisional order reopens eligible alternatives without rewriting the accepted offer's history. The Client Support form opens a prefilled email draft; a Host must configure a real support email in Admin → Settings, and the Client must send the draft from their email app. There is no payment processor or Client-side payment action.

## API routes

All business routes use `/api/v1`. Auth routes:

- `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
- `GET /support/contact` returns only the configured public support email (or `null` when no real address is configured).

Seller routes (authenticated; commercial routes require verified seller status):

- `GET /seller/dashboard`
- `GET|POST /seller/inventory`, `GET|PATCH|DELETE /seller/inventory/:id`, `POST /seller/inventory/:id/stock`
- `GET /seller/requests`, `GET /seller/requests/:id`
- `GET|POST /seller/offers`, `GET|PATCH /seller/offers/:id`
- `GET /seller/orders`, `GET /seller/orders/:id`, `POST /seller/orders/:id/events`
- `GET /seller/sales`
- `GET|PATCH /seller/profile`
- `GET /seller/notifications`, `PATCH /seller/notifications/read-all`, `PATCH /seller/notifications/:id/read`
- `GET /seller/conversations`, `GET|POST /seller/conversations/:id/messages`

OpenAPI JSON is available at `http://localhost:4000/api/v1/openapi.json`.

## Host/Admin API

Host routes share this API and PostgreSQL database under `/api/v1/host`. Host accounts must be provisioned explicitly; public Host registration is not available. Create the first Host account with `HOST_ADMIN_EMAIL` and a unique `HOST_ADMIN_PASSWORD` (at least 16 characters) set in the environment, then run `npm run db:host:create --prefix server` from the Seller root after the database migration is applied. This command refuses to overwrite an existing email. Host endpoints cover overview metrics, user and seller moderation, seller verification, requests, offers, orders, derived order transactions, categories, settings, and Host audit events. The data model has no payment processor ledger, so transaction rows are derived from orders.

Money is stored as PostgreSQL `Decimal` and returned as decimal strings in TND. Inventory and seller ownership are always derived from the server session. Registration starts with `pending_verification`; no Seller endpoint can change that status. An authorized Host verification integration is required to approve accounts. Client ownership is derived from the authenticated session and checked in every Client business route.

## Tests and builds

```powershell
npm run server:test
npm run server:build
npm run build
```

The automated API tests cover health, invalid registration, and unauthenticated access. Tests requiring a PostgreSQL instance (database ownership, transactions, and financial calculations) need a configured test database and are not included in the database-free test run.

The PostgreSQL integration tests require `TEST_DATABASE_URL` to point at a dedicated disposable database whose name clearly contains `test`, `testing`, or `integration`; the guard refuses a missing or ambiguously named target without printing the connection string. Run migrations and tests only against that database. In PowerShell from `server/`, set `$env:TEST_DATABASE_URL` to the dedicated test database URL, set `$env:DATABASE_URL = $env:TEST_DATABASE_URL`, run `npx prisma validate`, `npm run db:deploy`, then `npm run test:integration`. The integration tests create and remove synthetic seller, Host, Client, request, offer, order, and document records. Unit tests require no database URL and refuse to run if only `DATABASE_URL` is set, preventing accidental use of the application database.

## Private Seller documents

Seller uploads use `PUT /api/v1/seller/documents/{rneDoc|taxDoc|addressDoc|authorizationDoc}` with the file bytes as the request body and its actual MIME type as `Content-Type`. Uploads require the Seller session cookie, are limited to 10 MiB each, and are checked against PDF/JPEG/PNG/WebP content signatures. Files are stored under `server/private-documents/` by default with randomized names; this directory is not served by Express. Sellers can list their own document metadata with `GET /api/v1/seller/documents` and remove unapproved uploads with `DELETE /api/v1/seller/documents/{kind}`.

Hosts review metadata at `GET /api/v1/host/sellers/{id}/documents`, download through the authenticated `.../{documentId}/file` route, and review with `PATCH .../{documentId}/review` (`approved` or `rejected`, with a required rejection reason). Seller verification requires an approved professional address document and approval of every submitted document. Replacing a rejected Seller's upload returns verification to pending. Superseded files are deleted after replacement; removed unapproved files are deleted. The repository has no antivirus scanner; production deployment should add malware scanning and move the provider-independent storage functions to a private object-storage adapter before accepting real identity documents.

The current operational verification policy is explicit in `src/documents/policy.ts`: `addressDoc` is mandatory; RNE, tax, and representation documents are optional uploads, but every submitted document must be approved before verification. The codebase does not establish legal or business rules by legal form, so make that policy decision before applying conditional requirements. Upload signature checks identify supported formats and are not malware scanning. Failed DB writes remove the newly written file; a scheduled cleanup removes unreferenced files older than 24 hours. It does not repair stale database rows whose files are missing.

The API periodically removes expired sessions and old orphaned private document files. Rate limiting currently uses the process-local express-rate-limit memory store; deploy one API instance unless a shared production store is configured. Production configuration must provide `DATABASE_URL`, a unique `COOKIE_SECRET`, and explicit HTTPS `APP_ORIGINS`. Configure HTTPS termination, a durable private document volume and backups, database backup/restore, and the migration rollback procedure before production. Never expose `PRIVATE_DOCUMENTS_DIR` through a static file server.

PostgreSQL integration tests must not silently run as skipped in CI. Run them with a disposable database using `npm run test:integration` from `server/`; the command exits with an error if `TEST_DATABASE_URL` is missing. CI creates an ephemeral PostgreSQL service, applies migrations, runs integration/unit tests, and builds the backend and all three frontends. Browser-based end-to-end acceptance tests are not yet configured; do not treat API integration tests as browser acceptance.
