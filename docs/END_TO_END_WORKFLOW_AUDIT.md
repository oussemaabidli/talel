# Talel End-to-End Workflow Audit

**Audit date:** 2026-10-16. **Basis:** source inspection at main HEAD 5431061 plus the Phase 1 verification record in docs/TECHNICAL_AUDIT_REMEDIATION.md. This is not a claim that browser journeys or database workflows were manually executed in this phase.

## Evidence and verification boundary

- Source paths and API implementation were inspected across Client, Seller, Admin and seller/server.
- The latest recorded backend unit run was **28 passed, 14 skipped**. The skipped cases require TEST_DATABASE_URL. A dedicated npm run test:integration exited at its guard because no database was configured; **no PostgreSQL integration case ran**.
- The Phase 1 report records a passing backend TypeScript check, Prisma schema validation with a placeholder URL (no DB connection), and Client/Seller/Admin production builds. The backend production build remained blocked at Prisma Client generation by a Windows file lock.
- No Playwright/Cypress project or browser E2E run exists, and GitHub Actions was not run. Journeys below are **source-reviewed, not end-to-end verified**.

## Client journey

| Journey | UI and API/database path | Authorization and state | Gaps / evidence |
|---|---|---|---|
| Register, login, restore, logout | client/src/pages/LoginPage.tsx, client/src/App.tsx, client/src/api/client.ts; POST /api/v1/client/auth/register, /login, /logout; GET /auth/me in seller/server/src/routes/client.ts. | Server assigns CLIENT, hashes password, stores only session-token hash, and issues signed HTTP-only cookie. App checks session and hydrates before protected routes. | API wiring exists. Email verification, password recovery, and MFA routes/UI are absent. Rate limits are process-local. Session tests exist but DB suite did not run. |
| Create request | ClientCreateRequest.tsx uses GET /client/categories and POST /client/requests. | requireClient; clientId comes from session; Zod validation; active category checked in DB; location required; contact policy checks free-text; creates PUBLISHED request. | Source reviewed only. No categories are seeded by migrations or prisma/seed.ts, so Host must add categories before a fresh database can accept requests. Reference-image upload is unavailable and disclosed. |
| Edit request | ClientRequestDetail.tsx calls PATCH /client/requests/:requestId. | Owner, PUBLISHED state, and zero offers required; category/budgets/contact text validated; response updates local store. | Source reviewed. DB ownership/edit test was skipped. Vehicle data is not editable from this form. |
| Cancel request | ClientRequests.tsx calls POST /client/requests/:requestId/cancel. | Serializable transaction changes owned PUBLISHED/OFFERS_RECEIVED request to CANCELLED, rejects pending offers, creates seller notifications; otherwise 409. | Regression test covers notifications and cancellation/acceptance race, but **not run on PostgreSQL**. Transaction behavior remains unverified. |
| Read/reject/accept offers | ClientOffers.tsx, ClientOfferDetail.tsx; GET /client/offers; POST /client/offers/:id/reject, /accept, /conversation. | Offer list scoped through Client-owned requests. Reject changes PENDING to REJECTED and notifies Seller. Accept claims open request, accepts one offer, rejects competitors, creates one Order, event, conversation, and Seller notification in a serializable transaction. P2034 maps to 409. | Owner, competing-offer, and concurrency tests exist but were skipped. Sellers whose competing offers are rejected during acceptance receive no rejection notification. |
| Order history/detail/cancel | ClientOrders.tsx and ClientOrderDetail.tsx; GET /client/orders, GET /:id, POST /:id/cancel. | Reads scoped by request.clientId. Client cancellation allowed only in OFFER_ACCEPTED or SELLER_CONFIRMED; transaction cancels order/request, records event, notifies Seller. | There is no payment to refund. Seller status changes do not notify Client; Client state is hydrated on session bootstrap and can become stale without reload. |
| Messaging | ClientMessages.tsx, ClientOrderDetail.tsx, ClientOfferDetail.tsx; conversation/message endpoints. | Conversation membership required for reads/sends. Server contact policy blocks detected contact details unless Host setting disables it. | Heuristic only. Conversation list max 100; history returns earliest 500 ascending, no cursor, so later messages are inaccessible after that limit. No realtime/read receipts. |
| Notifications, profile, history | ClientNotifications.tsx, ClientProfile.tsx, dashboard/request/order lists; /client/notifications and read endpoints; PATCH /client/profile. | Notifications scoped to current user; profile upsert keyed by session user; server responses update local state. | Notifications max 100 without pagination. No account deletion/export found. Cross-session updates can be stale until refetch. Dashboard support action previously falsely claimed ticket creation; now shows an unavailable notice; no support API exists. |

## Seller journey

| Journey | UI and API/database path | Authorization and state | Gaps / evidence |
|---|---|---|---|
| Register/login/session | seller/src/pages/RegisterPage.tsx, LoginPage.tsx, App.tsx; /api/v1/auth/register, /login, /me, /logout. | Server creates SELLER and profile, bcrypt hash, session; status starts pending_verification. Browser cannot set role or verification. | Source reviewed. No recovery, email verification, or MFA. Auth throttling is process-local. |
| Submit documents | Registration wizard and document controls; PUT /seller/documents/:kind; GET/DELETE /seller/documents. | Seller session required; 10 MiB and MIME/signature checks; randomized files stored privately; DB metadata; failed DB write removes newly written file; approved document cannot be deleted. | Upload/review test skipped. Address proof is required by current backend operational policy and UI now says so; other document types are optional pending legal/business decision. Local disk only; no malware scanner or durable object storage. |
| Host review and approval | Admin document modal; /host/sellers/:id/documents, authenticated file route, review and verification patches. | Host role; rejection reason required; review and verification write audit rows; Seller remains restricted until required proof and all submitted docs approved. | Database test exists but skipped. No verified legal-form-specific document matrix. |
| Find requests and submit/withdraw offers | SellerRequests.tsx, SellerRequestDetail.tsx, SellerCreateOffer.tsx; GET /seller/requests, GET/POST /seller/offers, PATCH /seller/offers/:id. | Active Seller session and verified status; server checks request open, requested quantity, numeric total and contact text; sellerId from session; duplicate active offer prevented. | DB tests skipped. Request feed capped at 100 without pagination. Inventory is not linked to offer acceptance or stock reservation. Withdrawal does not notify Client. |
| Accepted order/fulfillment | SellerOrders/SellerOrderDetail; GET /seller/orders, /:id, POST /:id/events. | Seller ownership; only forward transitions: accepted → seller-confirmed → preparing → ready → dispatched → completed. Each writes an OrderEvent. | No carrier/tracking, delivery proof, returns, disputes, warranty claim, or Buyer notification on status changes. Completion notification currently targets Seller. No payment or settlement. |
| Messaging, alerts, account | SellerMessages, SellerNotifications, SellerProfile, SellerInventory; participant-scoped conversation APIs, notification/profile/inventory APIs. | Verified Seller required for commercial routes; inventory/profile scoped to session seller; contact policy enforced by API. | Conversation list max 100; history max 500 oldest; no paging. No account deletion/password recovery. Stock is not reserved on order. |

## Host/Admin journey

| Journey | UI and API/database path | Authorization and state | Gaps / evidence |
|---|---|---|---|
| Host login/session | admin/src/pages/LoginPage.tsx, admin/src/App.tsx, admin/src/api/host.ts; POST/GET /api/v1/host/auth/login and /me. | Host login limited; requireHost checks role, active state and expiry. Accounts provision out of band by prisma/create-host.ts; public Host registration absent. | Source reviewed. No MFA, recovery, or step-up auth; DB test skipped. |
| Registration review | Host Clients/Sellers and RegistrationDetailsModal; GET /host/users/:id/registration. | Host-only, private no-store data response. | Client registration details can be inspected, but no Client identity document review or distinct verified-client state exists; Host can activate/suspend. |
| Seller verification | HostSellers/document review UI; seller/documents/file/review and verification routes. | Host role; rejection reason; seller document review and verification actions audited. | Integration test for document submission-to-approval is skipped. File downloads are protected but viewing/downloading is not audited in source. |
| Moderation/oversight | Host user/seller/request/offer/order pages; PATCH /host/users/:id/status and read routes. | Suspension sets inactive, revokes sessions, audits. Host-only routes. | Request/offer/order reads capped at 200; no pagination. Some read-only access is not audited. |
| Order reporting | HostTransactions; GET /host/transactions?page&limit&status. | Host-only; exact DB Decimal string aggregates across all rows; cancelled separate; actual status retained. | 501-order regression test skipped. Overview/month chart still uses a capped list. Values are orders, not collected payments. |
| Categories/settings/activity | HostCategories/Settings/Activity; category CRUD, settings, activity routes. | Host-only; major changes transactionally audit logged. | Categories are not seeded, so Host setup is a prerequisite. Activity capped at 200; audit trail is not external immutable storage. |

## Cross-cutting findings

1. **Ownership and role controls are present in source:** Client queries derive owner from session; Seller resources derive seller ID from session; messages require conversation membership; Host routes require Host role. Do not treat source inspection as an IDOR test. Database ownership tests were skipped.
2. **Offer acceptance and request cancellation:** conditional updates, serializable transactions, 409 conflict mapping, notifications, and regression tests are present. The PostgreSQL tests have not run, so concurrency guarantees remain unverified.
3. **Sessions and security:** signed HTTP-only cookie, hashed session token, role/active/expiry checks, default seven-day TTL, periodic cleanup, HTTPS-only explicit production origins, and placeholder-secret rejection are source-present. Rate-limit state is per process; multi-instance deployment needs shared state. No explicit CSRF token/MFA test or implementation found.
4. **Contact policy:** server checks Client request and Seller offer/message free text, with structured reference exclusions. Detection remains heuristic and cannot catch every encoding/language/bypass.
5. **Documents:** private local storage, file signature/size checks, and old generated-name orphan cleanup exist. No malware scan, durable object store, restore drill, or view/download audit log.
6. **Fixtures:** server seed requires ALLOW_DEMO_FIXTURES=true, refuses production, and labels synthetic records. Frontend mock fixtures still exist. API restoration and error paths must be browser-tested before claiming fixtures cannot appear on every production route.
7. **Payments:** no payment processor, escrow, fees/commission ledger, payouts, refunds, or reconciliation are implemented.

## Test matrix and verdict

| Check | Recorded outcome | What it establishes |
|---|---|---|
| Backend unit suite | 28 passed; 14 integration tests skipped | Unit paths passed at Phase 1; no DB workflow proof. |
| Dedicated integration command | Exited 1 at TEST_DATABASE_URL guard; no tests ran | No safe test DB available; owner, concurrency, cancellation, 501-order, and verification cases remain open. |
| Prisma validation | Passed with placeholder local URL | Schema parses; no migration applied to clean DB. |
| Backend TypeScript check | Passed | Not a production build. |
| Frontend builds | Client, Seller, Admin passed per Phase 1 report; Phase 2 edits noted in final response | Bundling only, not API or browser verification. |
| Browser E2E / three-role workflow | Not configured or executed | Cross-role launch journey unverified. |

**Verdict:** source-reviewed features exist, but the marketplace workflow is **not E2E verified** and must not be called production-ready. Priority blockers are a safe PostgreSQL migration/integration run and browser acceptance testing. The launch plan is in docs/BUSINESS_LAUNCH_ROADMAP.md.
