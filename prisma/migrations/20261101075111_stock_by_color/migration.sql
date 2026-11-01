-- CreateEnum
CREATE TYPE "StockReason" AS ENUM ('OPENING', 'STOCK_IN', 'ADJUSTMENT', 'ORDER_CONFIRMED', 'ORDER_CANCELLED', 'ORDER_RETURNED');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "costPrice" INTEGER;

-- AlterTable
ALTER TABLE "Variant" ADD COLUMN     "costPrice" INTEGER,
ADD COLUMN     "lowStockAt" INTEGER NOT NULL DEFAULT 3;

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "variantId" TEXT,
    "productName" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "colorLabel" TEXT,
    "delta" INTEGER NOT NULL,
    "stockAfter" INTEGER NOT NULL,
    "reason" "StockReason" NOT NULL,
    "unitCost" INTEGER,
    "orderId" TEXT,
    "orderNumber" TEXT,
    "actor" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockMovement_productId_createdAt_idx" ON "StockMovement"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_variantId_createdAt_idx" ON "StockMovement"("variantId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Data: options that had no colour keep their quantity under a "default colour" the owner renames
-- or splits later, so nothing is lost.
UPDATE "Variant" SET "colorAr" = 'لون افتراضي', "colorEn" = 'Default'
WHERE "colorAr" IS NULL AND "colorEn" IS NULL;

-- Data: opening balance, so the ledger of every colour starts at its current stock.
INSERT INTO "StockMovement" ("id", "productId", "variantId", "productName", "sku", "colorLabel", "delta", "stockAfter", "reason", "actor", "note")
SELECT gen_random_uuid()::text, v."productId", v."id", p."nameAr", v."sku",
       NULLIF(concat_ws(' · ', v."colorAr", v."storage"), ''), v."stock", v."stock", 'OPENING', 'system', 'رصيد افتتاحي'
FROM "Variant" v JOIN "Product" p ON p."id" = v."productId"
WHERE v."stock" > 0;
