# Talel Business Launch Roadmap — Tunisia

**Prepared:** 2026-10-16
**Basis:** source review of the current repository, prior recorded verification results, and official Tunisian source material linked below. This is a product and operations roadmap, not legal advice. No payment, escrow, commission, or payout functionality is implemented or authorized by this document.

## Current launch position

Talel currently supports registration, Seller document submission and Host review, spare-parts requests, offers, offer acceptance into an order, order events, messaging, and notifications through three portals and one shared API/database. Those workflows have not been proven end to end in a browser. PostgreSQL integration cases for isolation, request cancellation, competing-offer acceptance, document verification, and 501-order reporting have not run because no safe disposable PostgreSQL database was available in the recorded verification. The project is therefore suitable for continued staging preparation, not a real public launch yet.

The current “order” records an accepted offer and subsequent status events. It is not evidence of a payment, delivery, seller settlement, commission, refund, or buyer protection. Talel currently has no payment collection, escrow, delivery integration, return/dispute workflow, formal customer support system, durable private document store, malware scanner, or verified restoration process. Fresh databases also need active marketplace categories created by a Host before Clients can publish requests.

## Legal and regulatory research notes

Official source material reviewed on 2026-10-16:

- The Ministry of Communication hosts [Law No. 2000-83 on electronic commerce and electronic exchanges](https://www.mtc.gov.tn/fileadmin/texte_juridiques/L2000-0083.pdf). Article 25’s pre-contract information list includes matters such as provider identity/contact, product characteristics and price, delivery, guarantees/after-sales service, payment, timing, withdrawal/return terms, and confirmation. A Tunisian lawyer must determine which disclosures apply to Talel as platform operator, which are the Seller’s responsibility, and how the planned transaction model changes that allocation.
- The [INPDP official laws and forms page](https://www.inpdp.tn/Formulaires.html) provides the Tunisian personal-data protection procedures and forms. The [official Law No. 2004-63 text](https://www.inpdp.tn/ressources/loi_2004.pdf) is the primary source for personal-data protection. Obtain advice from Tunisian privacy counsel and/or the INPDP on the required filing/authorization process for Talel’s actual purposes, document collection, vendors, hosting location, retention, and any cross-border data transfer. Do not assume a foreign privacy regime alone settles Tunisian requirements.
- The Ministry of Commerce’s [consumer rights information](https://commerce.gov.tn/droit-consom-commerce) discusses consumer guarantees and after-sales service. Have Tunisian counsel determine the applicable obligations for the platform, Sellers, and any B2B/B2C model, including returns, warranty statements, complaints, and delivery commitments.

These sources do not establish a legal conclusion about Talel’s role or launch obligations. Confirm that the texts remain current, including amendments and implementing rules, with qualified local counsel and the relevant authorities before public launch. No tax, company-registration, payment-service, consumer, or privacy obligation is asserted here beyond the cited source material.

## 1. Decisions and policies

| Item | Priority | Dependencies | Acceptance criteria | Needed |
|---|---|---|---|---|
| Define Talel’s role and initial market: marketplace intermediary, directory/lead service, agent, or Seller of record; B2B, B2C, or both. | P0 | Founder decision; Tunisian legal review | Written operating model identifies contracting parties, who sets price, who takes payment, who invoices, and who handles delivery/returns/support. Product copy and terms match it. | User approval; outside professional advice; some coding/content changes |
| Decide pilot transaction semantics and payment boundary. | P0 | Role/model above | Pilot terms say plainly whether Talel only introduces parties and whether money changes hands off-platform. UI distinguishes an accepted offer/order from a paid purchase. No payment is represented as collected unless integrated and reconciled. | User approval; legal/accounting advice; content changes |
| Set Seller verification policy by legal form and Seller type. | P0 | Role/model; legal review | Document matrix identifies required, optional, acceptable alternatives, reviewer checklist, rejection reason, re-review and suspension process. Address-proof requirement is explicit and consistently enforced. | User approval; outside legal advice; policy/UI/backend updates |
| Define whether and how Clients are verified. | P1 | Target market and fraud/support model | Documented risk-based policy distinguishes account/email/phone verification from identity checks; no Client is described as identity-verified without evidence. | User approval; privacy/legal advice; coding if checks are chosen |
| Approve parts taxonomy, location coverage, condition/quantity/vehicle fields and prohibited goods policy. | P0 | Pilot region and Seller cohort | Active categories and Tunisian locations exist in a clean environment; request form and API accept the same enumerated values; sample request can be published. | User approval; coding/seed or admin setup |
| Decide contact-sharing rules and how legitimate exceptions work. | P1 | Business model, support operations | Published policy and user-facing explanations exist; server behavior matches it; test set covers common false positives/negatives and appeal path. | User approval; legal advice; coding |
| Commission reviewed Terms of Service, privacy notice, Seller agreement, complaints/returns/warranty/delivery disclosures, document-retention schedule, and consent/acknowledgement language. | P0 | Role model, data inventory, delivery/payment decisions | Counsel approves published versions; signup links to them; system records version and acknowledgement time; operational owners and escalation path are named. | Outside professional advice; user approval; content and coding |
| Determine Tunisian privacy procedure and hosting/vendor transfer position. | P0 | Data inventory, selected hosting/storage/email/analytics vendors | Written advice/authority confirmation covers filings/permissions, sensitive registration documents, recipients, hosting country/transfers, retention, access/correction/deletion requests, and breach response. | Outside professional advice/authority; user approval; infrastructure changes as required |
| Choose support model, service hours, complaint intake and escalation. | P0 | Pilot size and roles | Users see a real monitored support contact; operating procedure records owner, response target, urgent fraud/safety escalation, and closure. Current in-app support notice is honest that ticketing is unavailable. | User approval; operations; optional coding |
| Decide delivery, cancellation, return, warranty and failed-fulfillment responsibilities. | P0 | Role model and Seller agreement | Every order screen/notice explains current status, who arranges delivery, applicable cancellation window and how to raise a complaint; no nonexistent protection is promised. | User approval; legal advice; coding/content |

## 2. Minimum safe pilot

Run a closed, invitation-only pilot after P0 policy items and the verification gates below are complete. Keep payments outside Talel only if that is the chosen and legally reviewed pilot model, and label this clearly to both parties.

| Item | Priority | Dependencies | Acceptance criteria | Needed |
|---|---|---|---|---|
| Complete a repeatable staging verification run against disposable PostgreSQL. | P0 | Safe DB service and credentials; CI/local setup | Clean migrations apply; all integration tests run without skips; ownership isolation, concurrent acceptance (one winner/one order), cancellation race/notifications, seller verification and 501-order aggregate assertions pass. Test output and DB cleanup are recorded. | Infrastructure/configuration; coding only for failures |
| Run browser acceptance journeys for Client, Seller and Host. | P0 | Staging API/database; synthetic accounts; seeded categories; browser environment | Register/login/refresh/logout, upload/review/approve, create/edit/cancel request, offer, accept, order transitions, messaging, notifications, suspension and cross-user denial are exercised; screenshots/logs/network results attached to a run record. | Test accounts and approval; coding only for reproduced defects |
| Make category and location setup repeatable. | P0 | Approved taxonomy/location policy | Fresh staging setup yields active categories and locations; a Client request can be created without manual SQL; invalid/inactive category and unsupported location are rejected with clear API errors. | Coding or documented Host setup; user approves taxonomy |
| Provision production-like hosting with HTTPS, explicit origin allowlists, secure cookie settings, unique strong secrets, least privilege and separate staging/production data. | P0 | Hosting choice; DNS/domain; launch policies | Security checklist passes; production refuses placeholder secrets; browser cookie/session works over HTTPS; only approved app origins can call API; no dev fixture or test account is present. | Infrastructure; user approval/cost; technical review |
| Replace local-only private Seller document storage with durable private storage and malware controls. | P0 | Hosting/data residency decision; privacy/legal review | Uploads are private, encrypted in transit and at rest, MIME/signature and size checked, quarantined/scanned before reviewer access, least-privilege download URLs/access enforced, deletion/retention tested, and restore procedure documented. | Infrastructure; coding; outside security/privacy advice; approval/cost |
| Establish backup and restoration. | P0 | Database/object-storage provider and retention decision | Automated encrypted backups cover database and documents; restore drill into isolated environment succeeds; RPO/RTO and retention are documented; alert on failure. | Infrastructure; user approval/cost |
| Add operational monitoring and incident response. | P0 | Hosting and support owner | Uptime/error/database/storage/backup alerts reach a named operator; logs exclude passwords, session tokens and document contents; response/runbook covers outage, account compromise, document exposure and data restoration. | Infrastructure/operations; coding/configuration; security advice |
| Close identity/session risk appropriate to pilot. | P1 | User and legal policy | Decide if email confirmation, password recovery, MFA for Hosts, session revocation UI and shared rate-limit storage are required; chosen controls are implemented and tested before cohort size requires them. Host accounts remain provisioned out of band until a safe admin-provisioning process exists. | User approval; coding/infrastructure; security advice |
| Set a manual Seller review/support operating procedure. | P0 | Verification matrix and support owner | Every application has documented status, reviewer, evidence checklist, rejection reason and escalation; review is completed before commercial routes unlock; support and fraud reports are acknowledged by the stated operator. | Operations; user approval; small UI/content improvements |
| Publish reviewed marketplace disclosures and acknowledgement records. | P0 | Legal and policy decisions | Required pages are live and accessible before registration/request/order; terms/privacy versions and acknowledgements are stored; support, delivery, payment and warranty responsibilities are consistent in all portals. | Outside legal advice; user approval; content/coding |
| Confirm end-user errors and stale-state behavior. | P1 | Browser acceptance run | Failed API writes never display as successful; server response is the basis for updates; stale sessions redirect cleanly; no mock fixtures silently masquerade as live records. | Coding for reproduced defect; browser testing |

## 3. Limited public launch

Expand only after the closed pilot has completed real support cycles and the P0 gates remain green. Start with a limited geography/category/Seller cohort and a named operator who can pause onboarding or marketplace activity.

| Item | Priority | Dependencies | Acceptance criteria | Needed |
|---|---|---|---|---|
| Gradually expand Seller and Client access with manual review capacity. | P0 | Pilot success; support and verification staffing | Cohort limit, review turnaround and abuse thresholds are defined; operator can suspend users and stop new requests/offers; weekly review of fraud/complaints is recorded. | User approval; operations; possibly coding |
| Make listing quality and availability visible. | P1 | Seller policy and taxonomy | Sellers can state stock/lead time, part condition, compatibility, quantity, price validity and delivery scope; Client sees when information is seller-provided/unverified. | User approval; coding |
| Make order fulfillment legible without implying payment or protection. | P0 | Delivery/cancellation policy | Client and Seller receive matching order states; status changes notify both parties or an explicit refresh path exists; cancellation/complaint instructions are visible; audit events can be reviewed. | User approval; coding |
| Provide a working complaint and incident intake path. | P0 | Support staffing and legal review | Complaint/contact channel is monitored; cases receive a reference, owner, status, response target and closure reason; urgent safety/fraud reports can freeze an account/listing. | Operations; coding if in-app case management is selected |
| Review pilot metrics without overstating financial activity. | P1 | Analytics/privacy review | Report requests, offers, accepted orders, fulfillment/complaint outcomes separately from collected money; tracking is disclosed and minimised; capped lists do not produce misleading totals. | User approval; privacy advice; coding/analytics |
| Conduct periodic security/privacy review and restore drills. | P1 | Production-like setup | Named owner completes a scheduled checklist and records fixes; backup restore and access review pass; document access is auditable. | Infrastructure/operations; outside advice |

## 4. Monetization

Choose a revenue model only after role, legal, tax, payment-provider and customer-support questions have been reviewed. Do not implement any option without separate explicit authorization. These are options, not features currently present.

| Option | Technical and operational implications | Decision gate / acceptance criteria |
|---|---|---|
| Seller subscription | Plans, billing lifecycle, invoices/receipts, entitlements, failed renewal, cancellation, tax/accounting treatment, and clear feature limits. | User approval and local accounting/legal advice; test renewals/refunds/plan changes; never equate a subscription with a transaction commission. |
| Paid lead or listing | Charge for qualified contact/request access or enhanced listings; event idempotency, fraud/duplicate controls, billing records, refunds/credits and disclosed ranking effects. | Define what counts as a delivered lead and complaint/refund rules; prove one charge per eligible event; user approval and legal/accounting advice. |
| Commission on completed transactions | Requires defensible completion definition, fee calculation, transaction ledger, invoices, refunds/chargebacks, Seller reconciliation, and evidence of completion. | Do not rely on current Order status as proof of payment or completed sale. User approval plus legal, tax/accounting and payment-provider advice; separately authorize coding. |
| Platform-collected payments / marketplace payments | Payment service provider integration, identity/KYC obligations as determined by provider/law, tokenized payment handling, signed webhooks, idempotency, reconciliation, refunds, disputes, settlement/payout states, and operational support. | Confirm provider availability and contract for Tunisia and chosen currencies; obtain legal/regulatory advice; security review and end-to-end sandbox tests before any live funds. Escrow must not be claimed unless specifically designed, approved and legally reviewed. |

For every model, financial reporting must distinguish request/offer/order values from amounts authorized, captured, refunded, disputed, paid out, and recognized as platform revenue. Add an auditable ledger and reconciliation before collecting or distributing money. No such ledger or collection path is verified in current Talel.

## 5. Scaling

| Item | Priority | Dependencies | Acceptance criteria | Needed |
|---|---|---|---|---|
| Make API sessions and rate limiting safe across multiple instances. | P1 | Pilot traffic and host choice | Shared durable session/rate-limit store, expiry/revocation semantics and failover tests are in place; thresholds are measured against abuse and normal traffic. | Infrastructure and coding; security review |
| Add pagination/cursors and query/index review for growing records. | P1 | Usage evidence | Client conversation/message/notification, Seller request, Host oversight and activity lists can traverse all records; query plans and aggregate accuracy are measured at representative volumes. | Coding and DB operations |
| Scale asynchronous notifications and file processing. | P2 | Traffic and provider choices | Queue retries are idempotent and observable; uploads remain quarantined until scan success; failed jobs alert an operator. | Infrastructure/coding |
| Establish capacity, recovery, security and privacy review cadence. | P1 | Stable production operation | Measured service objectives, capacity thresholds, restore tests, access reviews, vulnerability remediation and retention/deletion evidence are recorded on a schedule. | Infrastructure, operations, outside professional review |
| Add delivery/payment/dispute integrations only as approved products. | P2 | Decisions and legal/provider review | Each integration has a contract, failure/retry/refund/complaint design, security assessment, staging tests and explicit user approval before production activation. | User approval; outside professional advice; infrastructure/coding |

## Immediate launch blockers

1. Safe PostgreSQL migrations and integration suite have not been run; request cancellation, isolation, competing-offer acceptance, verification and large aggregates remain unverified.
2. No browser E2E has proven the three-role journey against a live shared staging environment.
3. Production-grade durable private document storage, malware scanning, backup/restore and operational monitoring are absent or unverified.
4. No reviewed legal/policy package or operating allocation for support, delivery, returns, warranty, complaints, privacy handling and the platform’s role is evidenced in the repository.
5. Fresh database category setup is not automatic; the pilot requires repeatable Host setup or a reviewed seed mechanism.
6. No payment collection/settlement exists. This is a blocker only if the chosen business model promises platform-handled payments; otherwise the pilot must clearly explain how parties transact and avoid implying Talel collected money.

## Decisions needed from the project owner

1. Is the first pilot B2B, B2C, or both, and is Talel a marketplace intermediary, lead service, agent, or Seller of record?
2. Will the pilot be invitation-only, and what Tunisia geography/categories/Seller cohort are in scope?
3. Does Talel intend to handle any money in the pilot? If not, what exact text should explain off-platform payment and responsibility?
4. Which legal forms and document alternatives should qualify a Seller, and is Client identity verification needed?
5. Who owns support, complaints, fraud response, delivery escalation, and document review, and what response targets can they meet?
6. Which hosting/storage region and vendors are acceptable after Tunisian privacy/legal review?
7. Which monetization option, if any, should be explored later? No payment or revenue feature should be built until separately authorized.

## Readiness verdict

**Not ready for public production launch.** The codebase has meaningful marketplace capabilities, but only source inspection and the previously recorded builds/unit run are evidence for this phase; the PostgreSQL integration suite, clean-database migration workflow, browser E2E, production infrastructure, and legal/operational readiness are not verified. The next sensible gate is a disposable PostgreSQL test run and a closed staging acceptance run using synthetic accounts, alongside the owner’s P0 business decisions and local professional review.
