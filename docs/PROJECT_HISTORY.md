# Talel Project History

**Scope reviewed:** all seven commits reachable from the current `main` HEAD as of 2026-10-16, their commit metadata and file-change summaries, the initial tree, and current architecture/source. The repository has no earlier Git commit. This is a commit-based reconstruction, not a line-by-line audit of every line in the 33,000-line initial snapshot; the history cannot establish work that predates the first commit or changes on uninspected remote branches.

## Commit timeline

| Commit | Date | Main change and evidence |
|---|---|---|
| `b1d314f` | 2026-10-15 | **Initial commit** (150 files). It established separate `client/`, `seller/`, and `admin/` React/Vite applications and a substantial `seller/server/` Express/TypeScript/Prisma backend. The schema and migrations already included Seller accounts, sessions, inventory, requests, offers, orders, messaging/notifications, early Host/Admin structures and seller-document storage. `client/src/data/mockData.ts`, `seller/src/data/mockData.ts`, `admin/src/data/mockData.ts`, and their Zustand stores were present. `client/` had no API client or Client backend routes yet. `README.md` described the three portals but did not describe the already-committed server. `conclusion.md` was already a mixed-state implementation guide. |
| `f0be79c` | 2026-10-15 | **Implement client portal API integration.** Added `client/src/api/client.ts`, Client auth/session bootstrap and API-backed forms/pages, `seller/server/src/routes/client.ts`, Client authentication middleware, and additive Client schema/migration changes. This was the key transition from a Client mock-only portal to a shared-API Client portal. |
| `1d70a18` | 2026-10-16 | **Improve client workflows and API coverage.** Refined Client create/edit/detail/dashboard/message/profile flows and backend behavior; added database integration cases under `seller/server/tests/client.integration.test.ts` and basic route tests. This commit extends the earlier integration rather than adding another backend. |
| `9b25337` | 2026-10-16 | **Refine marketplace workflows and contact controls.** Updated Client/Seller/Admin workflow pages and added server-side direct-contact checks and tests in `seller/server/src/messaging/` and the integration/unit suites. The policy became shared API enforcement rather than frontend-only validation. |
| `baeadd2` | 2026-10-16 | **Add host registration review details.** Added `admin/src/components/RegistrationDetailsModal.tsx`, registration-detail API support, Host endpoints, and tests so Hosts can inspect Client/Seller registration information. Seller document review and verification flow was also tightened. |
| `e7c818b` | 2026-10-16 | **Harden marketplace and document workflows.** Added the guarded integration-test command and `.github/workflows/ci.yml`, server cleanup/policy modules, private document cleanup safeguards, improved Client request cancellation and Host transaction pagination/aggregates, Admin API-backed behavior, and Client/Seller messaging error handling. Added regression cases for ownership, request cancellation, offer acceptance, 501-order aggregates, document handling, and verification. The PostgreSQL cases still require an explicit test database. |
| `5431061` | 2026-10-16 | **Improve international phone detection and currency precision.** Expanded contact detection to explicitly international phone numbers, retained three TND decimal places in Admin formatting, and updated the remediation report. This current HEAD also includes a regression test for international phone detection. |

Commit subjects, exact dates, and complete hashes are in `git log --reverse`; the short hashes above uniquely identify the seven commits in this history.

## Architecture at the first checked-in snapshot

The initial tree was a three-application monorepo:

- `client/`: buyer-facing React/TypeScript/Vite portal, with pages for requests, offers, orders, messaging, notifications, profile, and a Zustand store.
- `seller/`: supplier-facing React/TypeScript/Vite portal, registration and marketplace/order/inventory screens, plus a `server/` directory.
- `admin/`: Host/Admin React/TypeScript/Vite portal with oversight, reports, settings, and a mock-backed store.
- `seller/server/`: one Node/Express/TypeScript API using Prisma and PostgreSQL. It already contained Seller auth/business routes, a Host router, database migrations, session middleware, and Seller-document functionality.

The portals had extensive mock fixtures and local state. Some API-client modules and server code existed in the initial commit, but that did not mean every UI page was actually wired to those APIs. In particular, the Client had not yet been integrated with its own owner-scoped API routes. The initial `README.md` presented the portals and ports but omitted the backend, migrations, and data ownership model. The initial `conclusion.md` is therefore evidence of an earlier documentation snapshot, not a reliable description of current HEAD.

## Major evolution and architectural decisions

### One shared backend and database

The project kept the backend in `seller/server/` rather than creating separate Client and Host servers. Later Client and Host routers were mounted on the same Express app under `/api/v1/client` and `/api/v1/host`; Seller endpoints remain under `/api/v1/seller` and the initial Seller auth routes under `/api/v1/auth`. Prisma migrations in `seller/server/prisma/migrations/` extend one PostgreSQL schema. This avoids duplicated marketplace records, but makes the Seller-named server directory and incomplete root documentation misleading.

### Role-specific sessions and ownership

Client, Seller, and Host routes share the signed, HTTP-only `talel_session` cookie and persisted session table. Authentication middleware derives the actor ID and role from the server-side session. Client request/order/conversation/notification operations scope queries by authenticated Client or conversation participant; Seller inventory/offers/orders similarly use authenticated Seller ownership. Host accounts are provisioned out of band; public Host registration is absent. Seller commercial routes require verified status, and account deactivation revokes sessions.

### Marketplace lifecycle and transaction integrity

Client requests and Seller offers were brought into one database-backed workflow. Accepting an offer transactionally moves the request, accepts one offer, rejects competing pending offers, creates one order/event/conversation, and notifies the accepted Seller. Later remediation made request cancellation transactional, marks pending offers rejected and notifies affected Sellers. Both offer-acceptance and cancellation-versus-acceptance scenarios have PostgreSQL regression tests, but those tests have not been observed passing in the current environment. The transaction design is therefore implemented and source-reviewed, not database-verified here.

### Host verification and document storage

Host APIs evolved from initial oversight routes to registration-detail inspection and private Seller-document review. The current operational policy requires an approved professional-address document and approval of every submitted document; RNE/tax/representation documents remain optional unless the business defines otherwise. Documents are stored in private local filesystem storage with size/signature checks. Cleanup only targets old, generated-name orphan files. No malware scanner or durable object-storage adapter exists.

### Reporting and money semantics

Host order reporting moved from a capped list and approximate UI totals to paginated order rows with database-wide PostgreSQL Decimal aggregates. Currency presentation retains TND millimes. These figures are **order values derived from marketplace orders**, not captured payments, seller settlements, commissions, or payouts. The Admin overview chart still uses capped order data, so long-range chart totals are not guaranteed complete.

### Contact policy, notifications, and support

Contact-detail restrictions are enforced by the shared API for request/offer/message text and can be controlled by a platform setting. Detection remains heuristic. Cancellation and offer acceptance create server notifications for some Seller events; several events, especially Seller order-state changes, do not notify the Client. A Client dashboard support button previously claimed a support ticket had been created even though no support API exists; the current Phase 2 change replaces that false claim with an explicit unavailable message.

## Current architecture

```text
client/ React + TypeScript + Vite ─┐
seller/ React + TypeScript + Vite ──┼─> seller/server/ Express + TypeScript + Prisma ─> PostgreSQL
admin/  React + TypeScript + Vite ──┘             shared sessions, routes, and business tables
```

Current roles and responsibilities:

- **Client:** registration/login, profile, parts requests, offers, orders, messages, and notifications through Client API routes.
- **Seller:** registration, profile, private verification uploads, marketplace requests/offers, inventory, orders, messages, and notifications through the shared API.
- **Host/Admin:** Host-only login and management routes for registrations, moderation, Seller verification/document review, marketplace oversight, categories, settings, reports, and audit events.
- **Backend/database:** one API, one Prisma schema, PostgreSQL transaction rules, server-side validation/ownership, shared user/session/business records.

This is materially different from the initial Client experience: the Client now has a separate role-scoped API and uses the same marketplace records as Seller and Host. It is also more integrated than the original root documentation implied. However, browser-based acceptance tests, a verified clean migration run in the present workspace, production infrastructure, durable/virus-scanned private storage, payment processing, dispute resolution, and full buyer-facing state notifications remain absent or unverified.

## Known documentation and history limits

- `README.md` still largely describes the three frontend apps and does not fully document the shared API lifecycle.
- `conclusion.md` says the Client is mock-driven and not API-connected, which contradicts commits `f0be79c` and later and current Client source. It should be updated separately; it was not rewritten in this history task.
- `docs/TECHNICAL_AUDIT_REMEDIATION.md` is the source for the exact prior test/build results and blockers. A successful frontend build does not verify PostgreSQL transactions or browser workflows.
- No commit was created for this Phase 2 work. The initial Git check for this phase was a clean worktree on `main` at `5431061`; the current status is reported in the final response.
