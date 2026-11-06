-- Manual orders, shipment tracking, real profit, WhatsApp inbox and automations.
-- Only adds tables and columns. Existing rows change only in the new columns filled below.

CREATE TYPE "OrderSource" AS ENUM ('WEBSITE', 'WHATSAPP', 'PHONE', 'INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'OTHER');
CREATE TYPE "ExpenseScope" AS ENUM ('BUSINESS', 'PERSONAL');
CREATE TYPE "CapitalType" AS ENUM ('INJECTION', 'WITHDRAWAL');
CREATE TYPE "WaDirection" AS ENUM ('IN', 'OUT');
CREATE TYPE "AutomationJobStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'SKIPPED', 'FAILED');

ALTER TABLE "Settings"
  ADD COLUMN "defaultDeliveryCost" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "defaultReturnCost" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Order"
  ADD COLUMN "source" "OrderSource" NOT NULL DEFAULT 'WEBSITE',
  ADD COLUMN "carrier" TEXT,
  ADD COLUMN "trackingNumber" TEXT,
  ADD COLUMN "carrierStatus" TEXT,
  ADD COLUMN "carrierFee" INTEGER,
  ADD COLUMN "deliveredAt" TIMESTAMP(3),
  ADD COLUMN "returnedAt" TIMESTAMP(3),
  ADD COLUMN "codReceivedAt" TIMESTAMP(3),
  ADD COLUMN "codReceivedAmount" INTEGER;

ALTER TABLE "OrderItem" ADD COLUMN "unitCost" INTEGER;

-- Orders from before this change: dates from their status log, purchase price from what the catalogue holds now.
UPDATE "Order" o SET "deliveredAt" = l.at
FROM (SELECT "orderId", max("createdAt") AS at FROM "OrderStatusLog" WHERE "toStatus" = 'DELIVERED' GROUP BY "orderId") l
WHERE l."orderId" = o."id";

UPDATE "Order" o SET "returnedAt" = l.at
FROM (SELECT "orderId", max("createdAt") AS at FROM "OrderStatusLog" WHERE "toStatus" = 'RETURNED' GROUP BY "orderId") l
WHERE l."orderId" = o."id";

UPDATE "OrderItem" i SET "unitCost" = COALESCE(v."costPrice", p."costPrice")
FROM "Variant" v JOIN "Product" p ON p."id" = v."productId"
WHERE i."variantId" = v."id";

CREATE INDEX "Order_trackingNumber_idx" ON "Order"("trackingNumber");
CREATE INDEX "Order_status_deliveredAt_idx" ON "Order"("status", "deliveredAt");
CREATE INDEX "Order_status_returnedAt_idx" ON "Order"("status", "returnedAt");

CREATE TABLE "ShipmentEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "actor" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShipmentEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ShipmentEvent_orderId_occurredAt_idx" ON "ShipmentEvent"("orderId", "occurredAt");
ALTER TABLE "ShipmentEvent" ADD CONSTRAINT "ShipmentEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "scope" "ExpenseScope" NOT NULL DEFAULT 'BUSINESS',
    "category" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "spentOn" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "actor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Expense_scope_spentOn_idx" ON "Expense"("scope", "spentOn");

CREATE TABLE "CapitalEntry" (
    "id" TEXT NOT NULL,
    "type" "CapitalType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "occurredOn" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "actor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CapitalEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CapitalEntry_occurredOn_idx" ON "CapitalEntry"("occurredOn");

CREATE TABLE "WaConversation" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastInboundAt" TIMESTAMP(3),
    "lastPreview" TEXT,
    "unread" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WaConversation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WaConversation_phone_key" ON "WaConversation"("phone");
CREATE INDEX "WaConversation_lastMessageAt_idx" ON "WaConversation"("lastMessageAt");

CREATE TABLE "WaMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "wamid" TEXT,
    "direction" "WaDirection" NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'text',
    "body" TEXT NOT NULL,
    "templateName" TEXT,
    "status" TEXT,
    "error" TEXT,
    "actor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WaMessage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WaMessage_wamid_key" ON "WaMessage"("wamid");
CREATE INDEX "WaMessage_conversationId_createdAt_idx" ON "WaMessage"("conversationId", "createdAt");
ALTER TABLE "WaMessage" ADD CONSTRAINT "WaMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "WaConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "delayMinutes" INTEGER NOT NULL DEFAULT 0,
    "templateName" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL DEFAULT 'ar',
    "params" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AutomationRule_trigger_isActive_idx" ON "AutomationRule"("trigger", "isActive");

CREATE TABLE "AutomationJob" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "AutomationJobStatus" NOT NULL DEFAULT 'PENDING',
    "dueAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AutomationJob_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AutomationJob_ruleId_orderId_key" ON "AutomationJob"("ruleId", "orderId");
CREATE INDEX "AutomationJob_status_dueAt_idx" ON "AutomationJob"("status", "dueAt");
CREATE INDEX "AutomationJob_createdAt_idx" ON "AutomationJob"("createdAt");
ALTER TABLE "AutomationJob" ADD CONSTRAINT "AutomationJob_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutomationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
