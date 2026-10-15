# Talel Project Conclusion

Project guide and implementation recap for the Talel spare-parts marketplace monorepo. This document describes the code currently present in the workspace and calls out work that still depends on infrastructure or another portal integration.

## 1. Project at a glance

Talel is organized as three separate React applications backed by one shared API and one shared PostgreSQL database:

```text
Client portal (client/, port 3001) ─┐
Seller portal (seller/, port 3002) ─┼──> Shared Express API (seller/server/, port 4000) ──> PostgreSQL
Host/Admin portal (admin/, port 3003)┘
```

The backend lives at `seller/server/`; it is not a second API for each frontend. It was first built to support Seller. It now also has Host/Admin routes, and the Host portal uses those routes. The Client frontend remains a separate, mock-data-driven app and has not yet been connected to the API.

## 2. Languages, frameworks, and tools

| Area | Technologies |
|---|---|
| Frontend languages | TypeScript, TSX, JavaScript configuration, HTML, CSS |
| Frontend framework | React 19, Vite, React Router |
| State and UI | Zustand, Tailwind CSS, custom CSS, Lucide React |
| Charts | Recharts in Seller and Host/Admin |
| Backend | Node.js, Express 5, TypeScript |
| Validation and security | Zod, bcryptjs, HTTP-only signed cookies, hashed session tokens, Helmet, CORS allowlist, rate limiting |
| Database | PostgreSQL |
| ORM and schema language | Prisma ORM and Prisma Schema Language |
| API tests | Vitest and Supertest |
| Package management | npm and package-lock files |

## 3. What is implemented

### Client portal

The Client React app contains screens for a client dashboard, creating and managing spare-part requests, reviewing seller offers, tracking orders, messages, notifications, and profile settings. Its current data and login behavior come from local mock data and Zustand. There is no Client REST API integration yet, so its displayed actions do not create shared database records.

### Seller portal

The Seller React app is connected to the shared API. It includes:

- Seller registration and login, with accounts starting as `pending_verification`.
- A status page for sellers who have not yet been approved.
- Dashboard and sales summaries from backend records.
- Inventory listing, creation, editing, stock updates, and archive behavior.
- Marketplace request browsing and offer creation/withdrawal.
- Order viewing and allowed seller-side status transitions.
- Profile updates, messages, and notifications.
- API calls use a shared typed fetch client and include credentials for the session cookie.

The server determines the logged-in seller identity from the session. Seller IDs supplied by the browser are not used to authorize access. Commercial routes require an approved Seller profile.

### Host/Admin portal

The Admin frontend is in `admin/` (the actual directory name; the portal is referred to as Host in this project). It now uses the shared API for:

- Host credential login and server-session restoration.
- Dashboard totals, recent orders, categories, and Host audit activity.
- User and seller directories, suspension/reactivation, and seller verification status.
- Platform-wide request, offer, order, and order-derived transaction views.
- Category create, edit, activate/deactivate, and guarded deletion.
- Persistent key/value platform settings.
- Host management audit entries for moderation, verification, category, and setting changes.
- API-backed reports based on the currently loaded request, order, seller, and client records rather than fabricated headline totals.

Host access requires an active account with the explicit `HOST` role. There is no public Host registration route. A provisioning script creates a new Host user without promoting or overwriting an existing email account.

### Shared API and database

The existing database schema contains the core records used by the Seller portal: users, sessions, seller profiles, inventory parts, marketplace requests, offers, orders and order events, conversations, participants, messages, and notifications. The Host work extended that schema with:

- `User.isActive` for account suspension and reactivation.
- `HostAuditLog` for auditable Host management actions.
- `MarketplaceCategory` for persisted category management.
- `PlatformSetting` for persisted Host settings.

Money is stored as PostgreSQL decimal values with three fractional digits and is treated as TND in the Seller/Admin integrations.

## 4. API routes

Base URL in local development: `http://localhost:4000/api/v1`.

### Shared authentication

- `POST /auth/register` — create a Seller account and profile.
- `POST /auth/login` — Seller login.
- `POST /auth/logout` — remove the current session.
- `GET /auth/me` — return the authenticated Seller.

### Seller routes

- `/seller/dashboard`
- `/seller/profile` (`GET`, `PATCH`)
- `/seller/inventory` (`GET`, `POST`)
- `/seller/inventory/:id` (`GET`, `PATCH`, `DELETE`)
- `/seller/inventory/:id/stock` (`POST`)
- `/seller/requests` and `/seller/requests/:id` (`GET`)
- `/seller/offers` (`GET`, `POST`) and `/seller/offers/:id` (`GET`, `PATCH`)
- `/seller/orders`, `/seller/orders/:id` (`GET`), and `/seller/orders/:id/events` (`POST`)
- `/seller/sales`
- `/seller/conversations` and `/seller/conversations/:id/messages` (`GET`, `POST`)
- `/seller/notifications`, `/seller/notifications/read-all`, `/seller/notifications/:id/read`

Seller commercial routes require an approved Seller profile. Inventory and order writes apply ownership and business-rule checks.

### Host routes

- `POST /host/auth/login` — Host-only login; rate limited.
- `GET /host/auth/me` — validate the Host session.
- `GET /host/dashboard`
- `GET /host/users`, `PATCH /host/users/:id/status`
- `GET /host/sellers`, `PATCH /host/sellers/:id/verification`
- `GET /host/requests`, `/host/offers`, `/host/orders`, `/host/transactions`, `/host/activity`
- `GET`, `POST /host/categories`; `PATCH`, `DELETE /host/categories/:id`
- `GET /host/settings`, `PATCH /host/settings/:key`

Host routes verify a valid session, active user, and `HOST` role. Host account moderation is restricted to Client and Seller accounts; a Host cannot suspend itself through the moderation route. Suspending a user also removes that user's existing sessions. Category deletion is rejected when marketplace requests still use that category.

OpenAPI JSON is served at `/api/v1/openapi.json`.

## 5. Repository map and file responsibilities

The paths below are relative to the monorepo root (`talel/`). `seller/` is the current writable workspace directory.

### Monorepo root

- `README.md` — overview of the three portals and their development ports.
- `package.json` — root scripts to run or build Client, Seller, and Admin apps.
- `package-lock.json` — root npm dependency lockfile.
- `seller-register.html` — standalone Seller registration page/artifact present at the monorepo root.

### `client/` — Client / Buyer frontend

- `package.json`, `package-lock.json` — Client dependencies and lockfile.
- `index.html` — Vite HTML entry point.
- `vite.config.ts` — Vite and React plugin configuration.
- `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` — TypeScript project/build settings.
- `tailwind.config.js`, `postcss.config.js` — styling build configuration.
- `README.md` — Client app notes.
- `public/favicon.svg`, `public/icons.svg` — browser icon and shared SVG symbols.
- `src/main.tsx` — React app entry point and root rendering.
- `src/App.tsx` — Client routes and page layout.
- `src/App.css`, `src/index.css` — application and global styles.
- `src/types/index.ts` — Client-side domain and form types.
- `src/store/useStore.ts` — Zustand state and mock-backed Client actions.
- `src/data/mockData.ts` — sample users, requests, offers, orders, messages, and other demo records.
- `src/utils/helpers.ts` — formatting and display helpers.
- `src/components/ui/index.tsx` — reusable UI controls and components.
- `src/layouts/ClientLayout.tsx` — Client navigation and page shell.
- `src/pages/LoginPage.tsx` — mock/local Client sign-in page.
- `src/pages/client/ClientDashboard.tsx` — Client overview.
- `src/pages/client/ClientCreateRequest.tsx` — request creation form.
- `src/pages/client/ClientRequests.tsx` — request list and management.
- `src/pages/client/ClientRequestDetail.tsx` — request details and incoming offers.
- `src/pages/client/ClientOffers.tsx` — offer list.
- `src/pages/client/ClientOfferDetail.tsx` — offer details.
- `src/pages/client/ClientOrders.tsx` — Client order list.
- `src/pages/client/ClientOrderDetail.tsx` — Client order timeline and details.
- `src/pages/client/ClientMessages.tsx` — conversation view.
- `src/pages/client/ClientNotifications.tsx` — notification list.
- `src/pages/client/ClientProfile.tsx` — Client profile view/edit.
- `src/assets/hero.png`, `src/assets/react.svg`, `src/assets/vite.svg` — image and starter assets.

### `seller/` — Seller frontend and shared backend

#### Seller frontend and configuration

- `package.json`, `package-lock.json` — Seller frontend dependencies and scripts, plus scripts that delegate backend work to `server/`.
- `index.html` — Vite HTML entry point.
- `vite.config.ts` — Vite and React plugin configuration.
- `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` — TypeScript configuration.
- `tailwind.config.js`, `postcss.config.js` — styling configuration.
- `.env.example` — example Seller frontend API URL configuration.
- `README.md` — Seller startup and shared API notes.
- `public/favicon.svg`, `public/icons.svg` — browser icon and SVG symbols.
- `src/main.tsx` — React entry point.
- `src/App.tsx` — Seller routes, session bootstrap, and route guards.
- `src/App.css`, `src/index.css` — application and global styling.
- `src/api/client.ts` — typed API fetch wrapper with cookie credentials and API error handling.
- `src/types/index.ts` — Seller frontend domain types.
- `src/store/useStore.ts` — Seller UI state and persisted presentation preferences.
- `src/data/mockData.ts` — legacy/demo data; API-backed Seller screens load backend data.
- `src/utils/helpers.ts` — formatting and display helpers, including currency formatting.
- `src/components/ui/index.tsx` — shared Seller UI components.
- `src/layouts/SellerLayout.tsx` — Seller app navigation and shell.
- `src/pages/LoginPage.tsx` — Seller login form.
- `src/pages/RegisterPage.tsx` — multi-step Seller registration form.
- `src/pages/SellerStatusPage.tsx` — pending or restricted verification status page.
- `src/pages/seller/SellerDashboard.tsx` — Seller dashboard and current business metrics.
- `src/pages/seller/SellerInventory.tsx` — inventory management.
- `src/pages/seller/SellerRequests.tsx` — marketplace request list.
- `src/pages/seller/SellerRequestDetail.tsx` — request details.
- `src/pages/seller/SellerCreateOffer.tsx` — create offer form.
- `src/pages/seller/SellerOffers.tsx` — Seller offers.
- `src/pages/seller/SellerOrders.tsx` — Seller order list.
- `src/pages/seller/SellerOrderDetail.tsx` — order details and status events.
- `src/pages/seller/SellerSales.tsx` — Seller sales report.
- `src/pages/seller/SellerMessages.tsx` — Seller conversations and messages.
- `src/pages/seller/SellerNotifications.tsx` — Seller notifications.
- `src/pages/seller/SellerProfile.tsx` — Seller profile view and update.
- `src/assets/hero.png`, `src/assets/react.svg`, `src/assets/vite.svg` — image and starter assets.

#### `seller/server/` — shared API

- `package.json`, `package-lock.json` — Node API scripts, production dependencies, and lockfile.
- `.env.example` — example API environment, including database URL, cookie secret, port, and CORS origins.
- `README.md` — backend setup, API routes, migrations, Host provisioning, and limitations.
- `tsconfig.json` — strict TypeScript server compilation settings.
- `vitest.config.ts` — test runner setup.
- `src/index.ts` — starts the Express server and handles shutdown.
- `src/app.ts` — Express middleware, shared authentication endpoints, Seller routes, OpenAPI, and error handling.
- `src/routes/host.ts` — Host login, authorization-protected platform APIs, data moderation, categories, settings, and audit writes.
- `src/middleware/auth.ts` — validates signed session cookies and enforces active Seller/Host roles and Seller verification.
- `src/config/env.ts` — validates environment variables and parses allowed frontend origins.
- `src/db.ts` — shared Prisma client instance.
- `prisma/schema.prisma` — enums and PostgreSQL models for users, sessions, Seller data, marketplace records, audit logs, categories, and settings.
- `prisma/migrations/migration_lock.toml` — Prisma migration provider metadata.
- `prisma/migrations/20261015120000_init/migration.sql` — initial shared Seller marketplace schema.
- `prisma/migrations/20261015130000_host_admin/migration.sql` — Host support migration: active user field, audit log, category, and setting tables.
- `prisma/seed.ts` — guarded synthetic marketplace request fixtures for development only.
- `prisma/create-host.ts` — creates a new explicit Host account from environment credentials; refuses to overwrite an existing email.
- `tests/setup.ts` — Vitest test setup.
- `tests/app.test.ts` — database-independent health, validation, OpenAPI, and unauthenticated access tests.
- `tests/seller.integration.test.ts` — optional PostgreSQL-backed Seller ownership/business-rule and Host authorization tests.

### `admin/` — Host/Admin frontend

- `package.json`, `package-lock.json` — Admin dependencies and scripts.
- `.env.example` — example shared API URL for the Admin app.
- `README.md` — Admin setup and Host account provisioning guidance.
- `index.html` — Vite HTML entry point.
- `vite.config.ts` — Vite and React plugin configuration.
- `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` — TypeScript configuration.
- `tailwind.config.js`, `postcss.config.js` — styling configuration.
- `public/favicon.svg`, `public/icons.svg` — browser icon and SVG symbols.
- `src/main.tsx` — React entry point.
- `src/App.tsx` — Admin routes, session restoration, and Host-only route guard.
- `src/App.css`, `src/index.css` — application and global styles.
- `src/api/host.ts` — typed Host API client, API error handling, login, and conversion/hydration of shared API records into Admin view state.
- `src/types/index.ts` — Host/Admin view model types.
- `src/store/useStore.ts` — Admin UI state, hydrated data, toast state; authentication is not trusted from local persisted state.
- `src/data/mockData.ts` — legacy sample dataset retained in the source; the Host app hydrates primary screen data from the API after authentication.
- `src/utils/helpers.ts` — date, status, and currency formatting.
- `src/components/ui/index.tsx` — reusable tables, dialogs, badges, toasts, and UI controls.
- `src/layouts/AdminLayout.tsx` — Host navigation and portal shell.
- `src/pages/LoginPage.tsx` — Host credentials login form.
- `src/pages/admin/HostOverview.tsx` — database-backed Host overview and recent activity.
- `src/pages/admin/HostUsers.tsx` — Client/Seller user list and account status moderation.
- `src/pages/admin/HostClients.tsx` — Client directory and status moderation.
- `src/pages/admin/HostSellers.tsx` — Seller directory, verification, and status moderation.
- `src/pages/admin/HostRequests.tsx` — platform-wide marketplace requests.
- `src/pages/admin/HostOffers.tsx` — platform-wide Seller offers.
- `src/pages/admin/HostOrders.tsx` — platform-wide orders and lifecycle timeline.
- `src/pages/admin/HostTransactions.tsx` — order value summary; explicitly indicates payment ledger and payouts are not connected.
- `src/pages/admin/HostReports.tsx` — reports and charts derived from currently loaded API records.
- `src/pages/admin/HostCategories.tsx` — persisted category management.
- `src/pages/admin/HostActivity.tsx` — Host management audit history.
- `src/pages/admin/HostSettings.tsx` — persisted platform policy values.
- `src/assets/hero.png`, `src/assets/react.svg`, `src/assets/vite.svg` — image and starter assets.

## 6. Local setup and run instructions

### Configure the shared API/database

From `talel/seller/` in PowerShell:

```powershell
Copy-Item server/.env.example server/.env
# Edit server/.env: set DATABASE_URL, COOKIE_SECRET (32+ random characters),
# and APP_ORIGINS including the frontends you will run (Seller 3002, Host 3003).
npm run server:install
npm run server:db:deploy
```

Start the API in one terminal:

```powershell
npm run server:dev
```

Create a Host account after the database migration has been applied. Use a unique password of at least 16 characters; do not commit or paste credentials into source files:

```powershell
$env:HOST_ADMIN_EMAIL = 'admin@example.com'
$env:HOST_ADMIN_PASSWORD = 'use-a-unique-password-of-at-least-16-characters'
npm run db:host:create --prefix server
Remove-Item Env:HOST_ADMIN_EMAIL
Remove-Item Env:HOST_ADMIN_PASSWORD
```

### Run the frontends

In separate terminals, from the monorepo root:

```powershell
npm run dev:client
npm run dev:seller
npm run dev:admin
```

The Client app is at `http://localhost:3001`, Seller at `http://localhost:3002`, Admin/Host at `http://localhost:3003`, and the shared API at `http://localhost:4000`.

To configure Admin's API URL, copy `admin/.env.example` to `admin/.env.local`. Seller's example is `seller/.env.example`. The API's CORS allowlist is controlled by `APP_ORIGINS` in `seller/server/.env`.

## 7. Verification performed

- Prisma schema validation passed.
- Shared API TypeScript/Prisma build passed.
- Host/Admin TypeScript and production Vite build passed.
- Database-independent API tests passed: 5 passed.
- PostgreSQL-dependent integration tests were skipped because `TEST_DATABASE_URL` and a configured test database were not available.

## 8. Current setup state and known limitations

The migration files are present, but the PostgreSQL migration has **not** been applied in this workspace. No database connection or Host account is configured here. Consequently, API-backed registration/login and Host management need the setup steps above before they can run against persistent data.

Other boundaries in the current implementation:

- The Client frontend still uses local mock data and does not create Client users or marketplace requests through the shared API.
- The shared API has a `CLIENT` role and marketplace request model, but Client registration/request submission/offer acceptance are not implemented in this project slice.
- Seller registration can collect document selections in the browser, but private file upload/storage and document review are not configured. Verification status is maintained on the Seller profile; Host can update that status.
- Admin transaction screens summarize orders. There is no payment processor, escrow, payout ledger, or actual platform fee collection model. Settings are persisted, but payment-related values are not applied to payouts.
- Host audit logs currently capture Host management actions; they are not a full event stream of every Seller or Client action.
- Ratings, review counts, Client profile details, and some historical marketplace analytics do not have matching backend models yet; those fields cannot be populated with authoritative data.
- The submitted Host requirements text ended during the role/authentication section. This implementation follows the visible requirements and keeps Host privileges limited to separately provisioned `HOST` accounts.

## 9. Useful references

- Seller and shared API instructions: `seller/README.md` and `seller/server/README.md`.
- Host-specific setup: `admin/README.md`.
- Shared database model: `seller/server/prisma/schema.prisma`.
- Host API implementation: `seller/server/src/routes/host.ts`.
- Host frontend integration: `admin/src/api/host.ts`.
