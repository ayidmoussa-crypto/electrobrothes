-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "focusKeywordAr" TEXT,
ADD COLUMN     "focusKeywordEn" TEXT,
ADD COLUMN     "seoDuplicateTitle" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "seoProblems" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "seoScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "seoScoreAr" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "seoScoreEn" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "seoScoredAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SeoDailyScore" (
    "day" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "products" INTEGER NOT NULL,
    "green" INTEGER NOT NULL,
    "orange" INTEGER NOT NULL,
    "red" INTEGER NOT NULL,
    "problems" INTEGER NOT NULL,

    CONSTRAINT "SeoDailyScore_pkey" PRIMARY KEY ("day")
);

-- CreateIndex
CREATE INDEX "Product_isActive_seoScore_idx" ON "Product"("isActive", "seoScore");
