-- CreateEnum
CREATE TYPE "ExternalRatingStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "decidedBy" TEXT,
ADD COLUMN     "locale" TEXT,
ADD COLUMN     "orderItemId" TEXT,
ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "replyText" TEXT,
ADD COLUMN     "suggestedReply" TEXT,
ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ExternalRating" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "ratingMax" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "ratingCount" INTEGER,
    "summaryAr" TEXT,
    "summaryEn" TEXT,
    "status" "ExternalRatingStatus" NOT NULL DEFAULT 'PENDING',
    "lastCheckedAt" TIMESTAMP(3) NOT NULL,
    "suggestedByAi" BOOLEAN NOT NULL DEFAULT false,
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExternalRating_status_lastCheckedAt_idx" ON "ExternalRating"("status", "lastCheckedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalRating_productId_url_key" ON "ExternalRating"("productId", "url");

-- CreateIndex
CREATE UNIQUE INDEX "Review_orderItemId_key" ON "Review"("orderItemId");

-- CreateIndex
CREATE INDEX "Review_isApproved_rejectedAt_createdAt_idx" ON "Review"("isApproved", "rejectedAt", "createdAt");

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalRating" ADD CONSTRAINT "ExternalRating_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
