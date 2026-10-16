# Talel Technical Audit Remediation

## Initial inspection

- Starting branch: `main`; starting commit: `baeadd25e3b2435580a9e28a26b1acfd6a41d464`.
- Starting worktree: clean. No user changes were present to preserve.
- Architecture: three Vite/React frontends (`client/`, `seller/`, `admin/`) share the Express/TypeScript API and Prisma/PostgreSQL schema at `seller/server/`.
- Current schema has request states `PUBLISHED`, `OFFERS_RECEIVED`, `OFFER_ACCEPTED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`; offer states `PENDING`, `ACCEPTED`, `REJECTED`, `WITHDRAWN`, `EXPIRED`; and order states `OFFER_ACCEPTED`, `SELLER_CONFIRMED`, `PREPARING`, `READY`, `DISPATCHED`, `COMPLETED`, `CANCELLED`.
- Existing tests are Vitest unit and PostgreSQL integration tests. Integration tests select/skip based on `TEST_DATABASE_URL`; no `.github` CI workflow or browser E2E setup is present in the checkout.
- Existing seller document behavior requires an approved `addressDoc` and all uploaded documents approved. The source does not define conditional legal requirements for RNE/tax documents by business type; that remains a product/business-policy decision.
- Confirmed source gaps for remediation: request contact filtering omits several user-provided fields; cancellation only changes the request and leaves pending offers actionable in their own status; Admin transaction listing is capped at 500 and dashboard gross order value is not named consistently with payment semantics; seller conversation summaries load up to 100 messages per conversation; sessions are only removed on logout/account disable and have no scheduled expiry cleanup.
- Document storage uses local private files and signature/type checks, but no malware scanning or durable object-storage adapter. No configured disposable PostgreSQL credentials or CI/browser runner are assumed available until verified.

## Implementation plan and assumptions

1. Centralize contact checks across user-controlled request, offer, and message text while exempting structured identifiers where appropriate; test normalization and the policy toggle.
2. Make seller document requirements explicit as an operational policy without asserting unverified legal obligations; preserve private access and improve file/database failure handling.
3. Make request cancellation transactional and safe against offer acceptance, with consistent pending-offer state and notifications. Accepted orders will not be silently cancelled.
4. Make Admin transaction pagination and aggregate order-value reporting complete, status-accurate, and clear that values are not collected payments.
5. Add an executable, isolated browser acceptance setup only if compatible installed tooling and safe disposable database configuration are available; otherwise document the precise blocker and implement CI safeguards.
6. Improve session cleanup/configuration and bound hot list/conversation endpoints where callers can be updated safely.
7. Add regression tests, run focused and full available checks, and record exact observed outcomes below.

## Acceptance criteria

- Contact policy is server-side and reused for all relevant text mutations; benign OEM/part references remain accepted.
- Seller verification cannot succeed without the required approved professional address document and review of every submitted document; replacements remain pending.
- Cancellation updates the request and pending offers atomically, notifies affected sellers, rejects repeated/invalid transitions, and does not undo accepted orders.
- Admin status labels cover every Prisma status, transaction lists are paginated, and dashboard order-value totals use the complete database aggregate without claiming payment collection.
- Storage, sessions, rate limits, deployment assumptions, and unimplemented infrastructure are accurately documented.
- Required verification is reported only when actually run; database/browser blockers are identified rather than treated as passes.

## Findings and implementation results

### P1 — Contact policy: PARTIALLY DONE

- Confirmed: request creation/editing checked only part name and description; Seller offer creation omitted warranty, estimated delivery, and other free-text values. Messages had a separate call into the same basic detector.
- Changed `seller/server/src/messaging/contentRules.ts` and `contactPolicy.ts` to normalize Unicode, verbal `at`/`dot`, whitespace, punctuation, and common URL/phone forms, then apply one shared server validator. Request and offer structured reference fields are excluded to avoid blocking legitimate OEM identifiers.
- Applied to Client request create/edit, Seller offer creation, and Client/Seller messages. Added 30-per-15-minute process-local limits to Client submissions, Seller offers/messages, and Host moderation/document-review actions.
- Added unit cases for obfuscation, OEM/reference false positives, and omitted free-text fields; expanded PostgreSQL API tests for request/offer fields and the setting enabled/disabled.
- Limitations: detection is heuristic, language-specific, and can be bypassed by sufficiently unusual encodings. The database-backed toggle/API regression tests were added but not executed because no disposable test database URL was supplied.

### P1 — Seller document policy/storage: PARTIALLY DONE

- Confirmed: verification already required an approved `addressDoc` and approval of every submitted document, but the rule was embedded inline and legal-form-specific RNE/tax requirements were not defined by the repository.
- Added `seller/server/src/documents/policy.ts`: address proof is mandatory; RNE/tax/representation documents are optional uploads, and every submitted one must be approved. Unknown document kinds are rejected by the policy. The legal/business rule by seller type still needs a product decision.
- Added a safe orphan-file sweeper for valid generated files older than 24 hours, scheduled at API startup and every six hours. Failed DB writes already remove the new file; replacement/deletion leftovers can be reconciled by the sweeper. Added a filesystem cleanup unit test.
- Existing authenticated Host download, `no-store`, generated names, private directories, 10 MiB limit, and PDF/image signatures remain. Signature checks are not malware scanning. Durable object storage, malware quarantine, backup/restore, and stale database rows whose files disappeared remain infrastructure work.

### P1 — Request cancellation: PARTIALLY DONE

- Confirmed: Client request cancellation previously changed only the request, leaving pending offers in `PENDING` and notifying no Seller.
- Changed `seller/server/src/routes/client.ts` to atomically mark the request cancelled, mark pending offers rejected, and create Seller notifications in a serializable transaction. Offer creation now conditionally reclaims an open request inside its transaction, so it cannot commit after cancellation. Accepted offers/orders are not silently undone.
- Added PostgreSQL regression scenarios for zero/multiple pending offers, repeat cancellation, invalidation notifications, accepted state, and concurrent accept-vs-cancel consistency. They remain unexecuted until a disposable database is configured.

### P2 — Admin order reporting: PARTIALLY DONE

- Confirmed: `/host/transactions` returned only the newest 500 orders; the Admin mapped every non-completed state to `processing`; dashboard totals accumulated only the currently loaded frontend rows.
- Changed the endpoint to paginate at up to 100 rows, preserve every Prisma order status, filter by status, and calculate database Decimal totals across the complete order dataset. Cancelled order value is reported separately and excluded from gross marketplace order value; completed order value remains separate. Names and UI text describe orders, not collected payments.
- Admin transaction list has page controls and uses aggregate totals; a 501-order regression test checks totals and cancelled filtering. Test is database-backed and was not run here. The overview chart still derives monthly values from a capped order list and needs an aggregate endpoint before it can be considered complete.

### P2 — Browser acceptance suite: BLOCKED

- Confirmed: no Playwright/Cypress dependency or browser E2E project exists in the manifests. No browser acceptance tests were added. The current machine has no configured disposable `TEST_DATABASE_URL`, so registration-to-order journeys cannot be safely exercised end to end.
- Added CI coverage for disposable PostgreSQL integration tests and frontend/backend builds, but CI itself has not been run and does not yet include browser tests. Add a browser runner and deterministic account setup before claiming this acceptance task complete.

### P2 — Production/storage/session hardening: PARTIALLY DONE

- Added production environment validation requiring explicit HTTPS origins and rejecting placeholder cookie secrets. Added scheduled expiry cleanup for sessions and old orphan files.
- Added process-local rate limits to messaging/marketplace and sensitive Host operations. The memory store means multi-instance deployment still requires a shared store or a supported single-instance topology. Cookie settings remain HTTP-only, signed, `SameSite=Strict`, and secure in production.
- Local disk storage, malware scanning, durable storage, backup/recovery, and production infrastructure are not provisioned or verified. No production service was contacted or modified.

### P3 — Performance/CI: PARTIALLY DONE

- Confirmed: Seller conversation summaries loaded up to 100 message bodies per thread; Client bootstrap fetched each thread history separately. Seller message-send/load failures could silently fall back to mock content and report false success.
- Conversation lists are now bounded to 100 summaries with only the latest message; Client bootstrap no longer makes one history request per conversation, and Client/Seller load a thread’s history on demand. Seller API failures now display errors and never create pretend local messages.
- Added required `test:integration` guard, GitHub Actions workflow with an ephemeral PostgreSQL service, migration deployment, backend checks, and all three builds. Added frontend lockfiles for reproducible `npm ci`.
- Other list endpoints remain capped inconsistently or lack pagination controls; full message-history routes still have fixed caps rather than cursor pagination. The Admin monthly chart also needs database-side aggregation.

## Verification log

- Starting state: `git status --short --branch` reported `main...origin/main` with a clean tree at `baeadd25e3b2435580a9e28a26b1acfd6a41d464`.
- `npm test -- --reporter=dot` from `seller/server/`: **passed**, 27 tests passed; 14 PostgreSQL integration tests skipped because `TEST_DATABASE_URL` was absent.
- `npm run test:integration` from `seller/server/`: **blocked as intended**, exited 1 with `TEST_DATABASE_URL is required...`; no integration tests ran. This prevents a dedicated integration command from silently succeeding without a test database.
- `npx tsc -p tsconfig.json` from `seller/server/`: **passed**.
- `npx prisma validate` with a local placeholder `DATABASE_URL` from `seller/server/`: **passed** schema validation. It did not connect to a database.
- `npm run build` from `client/`, `seller/`, and `admin/`: **passed** on the final frontend sources.
- `npm run build` from `seller/server/`: **failed at `prisma generate`** with Windows `EPERM` replacing `node_modules/.prisma/client/query_engine-windows.dll.node`. A live Talel API process (PID 6492, port 4000) holds the engine; it was left running to avoid interrupting the user. The backend TypeScript check passed separately.
- `git diff --check`: **passed** (Git emitted only CRLF normalization warnings).
- Clean migration application, PostgreSQL integration tests (including the new 501-order case and concurrency scenarios), CI workflow, and browser E2E have **not** been executed. No migration was needed or added because the Prisma schema did not change.

## Remaining risks and decisions

- Decide whether RNE and tax documents are mandatory or conditional for each supported seller legal/business type. Current source does not establish those rules.
- Local filesystem storage requires a durable private persistent volume, backup/restore testing, and a malware scanning/quarantine extension before real identity documents are accepted.
- Contact detection is heuristic; normalization and server-side coverage reduce common bypasses but cannot guarantee detection of all obfuscations or language variants.
- Provide and verify a disposable PostgreSQL test target to run migration and integration suites; the new CI database job is configuration only until an actual CI run succeeds.
- Add browser E2E tests and complete database-side pagination/aggregate reporting before acceptance or launch-readiness claims.
- Payment processing, escrow, commission collection, and payouts are not represented as implemented capabilities.
