ALTER TABLE "MarketplaceRequest"
  ADD COLUMN "clientSubmissionKey" TEXT,
  ADD COLUMN "clientSubmissionHash" TEXT,
  ADD COLUMN "vehicleEngine" TEXT,
  ADD COLUMN "governorate" TEXT,
  ADD COLUMN "cancellationReason" TEXT;

CREATE UNIQUE INDEX "MarketplaceRequest_clientId_clientSubmissionKey_key"
  ON "MarketplaceRequest"("clientId", "clientSubmissionKey");

ALTER TABLE "Offer"
  ADD COLUMN "expiresAt" TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '7 days'),
  ADD COLUMN "reminderSentAt" TIMESTAMP(3);

UPDATE "Offer"
SET "expiresAt" = "createdAt" + INTERVAL '7 days';

CREATE INDEX "Offer_status_expiresAt_idx" ON "Offer"("status", "expiresAt");
