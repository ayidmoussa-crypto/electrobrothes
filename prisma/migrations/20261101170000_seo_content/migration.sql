-- CreateEnum
CREATE TYPE "SeoSuggestionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'SUPERSEDED', 'UNDONE');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "highlightsAr" TEXT[],
ADD COLUMN     "highlightsEn" TEXT[],
ADD COLUMN     "metaDescriptionAr" TEXT,
ADD COLUMN     "metaDescriptionEn" TEXT,
ADD COLUMN     "metaTitleAr" TEXT,
ADD COLUMN     "metaTitleEn" TEXT;

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "seoAutoApply" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ProductFaq" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "questionAr" TEXT NOT NULL,
    "answerAr" TEXT NOT NULL,
    "questionEn" TEXT NOT NULL,
    "answerEn" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductFaq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlugRedirect" (
    "slug" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "SlugRedirect_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "SeoSuggestion" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB NOT NULL,
    "needsCheck" BOOLEAN NOT NULL DEFAULT false,
    "status" "SeoSuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "autoApplied" BOOLEAN NOT NULL DEFAULT false,
    "nightly" BOOLEAN NOT NULL DEFAULT false,
    "model" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "decidedBy" TEXT,
    "undoneBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "undoneAt" TIMESTAMP(3),

    CONSTRAINT "SeoSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoRun" (
    "id" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "examined" INTEGER NOT NULL DEFAULT 0,
    "generated" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "suggestions" INTEGER NOT NULL DEFAULT 0,
    "autoApplied" INTEGER NOT NULL DEFAULT 0,
    "stoppedBy" TEXT,
    "actor" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "SeoRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductFaq_productId_idx" ON "ProductFaq"("productId");

-- CreateIndex
CREATE INDEX "SlugRedirect_productId_idx" ON "SlugRedirect"("productId");

-- CreateIndex
CREATE INDEX "SeoSuggestion_status_createdAt_idx" ON "SeoSuggestion"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SeoSuggestion_productId_status_idx" ON "SeoSuggestion"("productId", "status");

-- CreateIndex
CREATE INDEX "SeoRun_startedAt_idx" ON "SeoRun"("startedAt");

-- AddForeignKey
ALTER TABLE "ProductFaq" ADD CONSTRAINT "ProductFaq_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlugRedirect" ADD CONSTRAINT "SlugRedirect_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeoSuggestion" ADD CONSTRAINT "SeoSuggestion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
