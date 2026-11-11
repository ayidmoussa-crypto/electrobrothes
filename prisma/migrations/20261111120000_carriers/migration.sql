-- Delivery companies and their webhook settings.
CREATE TABLE "Carrier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trackingUrl" TEXT,
    "apiBaseUrl" TEXT,
    "credentials" TEXT,
    "webhookToken" TEXT NOT NULL,
    "trackingField" TEXT NOT NULL DEFAULT 'tracking',
    "statusField" TEXT NOT NULL DEFAULT 'status',
    "noteField" TEXT,
    "statusMap" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "lastEventAt" TIMESTAMP(3),
    "unknownStatuses" TEXT[],
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Carrier_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Carrier_webhookToken_key" ON "Carrier"("webhookToken");