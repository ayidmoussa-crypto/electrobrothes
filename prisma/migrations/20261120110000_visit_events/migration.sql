-- CreateTable
CREATE TABLE "VisitEvent" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "path" TEXT,
    "productId" TEXT,
    "query" TEXT,
    "results" INTEGER,
    "value" INTEGER,
    "orderId" TEXT,
    "channel" TEXT,
    "device" TEXT,
    "city" TEXT,
    "country" TEXT,
    "isNew" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VisitEvent_createdAt_idx" ON "VisitEvent"("createdAt");

-- CreateIndex
CREATE INDEX "VisitEvent_type_createdAt_idx" ON "VisitEvent"("type", "createdAt");

-- CreateIndex
CREATE INDEX "VisitEvent_sessionId_idx" ON "VisitEvent"("sessionId");

-- CreateIndex
CREATE INDEX "VisitEvent_productId_type_idx" ON "VisitEvent"("productId", "type");
