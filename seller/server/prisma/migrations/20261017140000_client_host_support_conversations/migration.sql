CREATE TYPE "ConversationType" AS ENUM ('MARKETPLACE', 'SUPPORT');

ALTER TABLE "Conversation"
ADD COLUMN "type" "ConversationType" NOT NULL DEFAULT 'MARKETPLACE',
ADD COLUMN "supportClientId" TEXT;

CREATE UNIQUE INDEX "Conversation_supportClientId_key" ON "Conversation"("supportClientId");

ALTER TABLE "Conversation"
ADD CONSTRAINT "Conversation_supportClientId_fkey"
FOREIGN KEY ("supportClientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
