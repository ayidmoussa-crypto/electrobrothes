-- Campaign Studio: home offers, a click counter and two attribution columns on orders. Nothing removed.
-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "landingTemplate" TEXT,
ADD COLUMN     "offerId" TEXT;

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "style" TEXT NOT NULL DEFAULT 'dark',
    "titleAr" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL DEFAULT '',
    "sublineAr" TEXT NOT NULL DEFAULT '',
    "sublineEn" TEXT NOT NULL DEFAULT '',
    "image" TEXT,
    "link" TEXT NOT NULL DEFAULT 'product',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "model" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "offerId" TEXT,
    "productId" TEXT,
    "template" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Offer_isPublished_sortOrder_idx" ON "Offer"("isPublished", "sortOrder");

-- CreateIndex
CREATE INDEX "CampaignEvent_createdAt_idx" ON "CampaignEvent"("createdAt");

-- CreateIndex
CREATE INDEX "CampaignEvent_offerId_type_idx" ON "CampaignEvent"("offerId", "type");

-- CreateIndex
CREATE INDEX "CampaignEvent_productId_type_idx" ON "CampaignEvent"("productId", "type");

-- CreateIndex
CREATE INDEX "Order_offerId_idx" ON "Order"("offerId");

-- CreateIndex
CREATE INDEX "Order_landingTemplate_idx" ON "Order"("landingTemplate");

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignEvent" ADD CONSTRAINT "CampaignEvent_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

