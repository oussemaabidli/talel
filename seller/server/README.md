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

Copy `.env.example` to `.env` in this folder and set `DATABASE_URL`, a random `COOKIE_SECRET` with at least 32 characters, and `APP_ORIGINS` for the portals you run (Client 3001, Seller 3002, Host 3003 by default). `PRIVATE_DOCUMENTS_DIR` is resolved relative to this `server/` directory; keep it outside static/public directories and do not commit its contents. Do not commit `.env`.

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

Apply the additive Client migration with `npm run server:db:deploy` after reviewing the configured database target. This repository change does not apply migrations automatically. Request reference-image uploads are unavailable because the existing private storage is specialized for Seller verification documents; the Client UI says this explicitly and never sends mock image URLs. There is no payment processor or Client-side payment action.

## API routes

All business routes use `/api/v1`. Auth routes:

- `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`

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

The PostgreSQL integration tests are enabled when `TEST_DATABASE_URL` points at a disposable database with the migrations applied. In PowerShell, set `$env:TEST_DATABASE_URL` and `$env:DATABASE_URL` to that test database URL, run `npm run server:db:deploy` from the Seller root, then run `npm run server:test`. The integration tests create and remove synthetic seller, Host, and marketplace records.

## Private Seller documents

Seller uploads use `PUT /api/v1/seller/documents/{rneDoc|taxDoc|addressDoc|authorizationDoc}` with the file bytes as the request body and its actual MIME type as `Content-Type`. Uploads require the Seller session cookie, are limited to 10 MiB each, and are checked against PDF/JPEG/PNG/WebP content signatures. Files are stored under `server/private-documents/` by default with randomized names; this directory is not served by Express. Sellers can list their own document metadata with `GET /api/v1/seller/documents` and remove unapproved uploads with `DELETE /api/v1/seller/documents/{kind}`.

Hosts review metadata at `GET /api/v1/host/sellers/{id}/documents`, download through the authenticated `.../{documentId}/file` route, and review with `PATCH .../{documentId}/review` (`approved` or `rejected`, with a required rejection reason). Seller verification requires an approved professional address document and approval of every submitted document. Replacing a rejected Seller's upload returns verification to pending. Superseded files are deleted after replacement; removed unapproved files are deleted. The repository has no antivirus scanner; production deployment should add malware scanning and move the provider-independent storage functions to a private object-storage adapter before accepting real identity documents.
