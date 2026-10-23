CREATE TABLE "RequestImage" (
    "id" TEXT NOT NULL,
    "requestId" TEXT,
    "clientId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "storageName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RequestImage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RequestImage_storageName_key" ON "RequestImage"("storageName");
CREATE INDEX "RequestImage_requestId_createdAt_idx" ON "RequestImage"("requestId", "createdAt");
CREATE INDEX "RequestImage_clientId_createdAt_idx" ON "RequestImage"("clientId", "createdAt");

ALTER TABLE "RequestImage" ADD CONSTRAINT "RequestImage_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MarketplaceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RequestImage" ADD CONSTRAINT "RequestImage_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
