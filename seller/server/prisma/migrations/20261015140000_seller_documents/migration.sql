CREATE TABLE "SellerDocument" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storageName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rejectionReason" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewerId" TEXT,
    CONSTRAINT "SellerDocument_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "SellerProfile" ADD COLUMN "verificationRejectionReason" TEXT;
CREATE UNIQUE INDEX "SellerDocument_storageName_key" ON "SellerDocument"("storageName");
CREATE UNIQUE INDEX "SellerDocument_sellerId_kind_key" ON "SellerDocument"("sellerId", "kind");
CREATE INDEX "SellerDocument_status_submittedAt_idx" ON "SellerDocument"("status", "submittedAt");
ALTER TABLE "SellerDocument" ADD CONSTRAINT "SellerDocument_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SellerDocument" ADD CONSTRAINT "SellerDocument_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Offer_one_pending_per_seller_request_key" ON "Offer"("sellerId", "requestId") WHERE "status" = 'PENDING';
