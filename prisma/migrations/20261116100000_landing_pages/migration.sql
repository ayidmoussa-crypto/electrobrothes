-- Landing pages: one per product, a new table only.
-- CreateTable
CREATE TABLE "LandingPage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "template" TEXT NOT NULL DEFAULT 'dark_premium',
    "sections" JSONB NOT NULL,
    "content" JSONB NOT NULL,
    "model" TEXT,
    "published" JSONB,
    "publishedAt" TIMESTAMP(3),
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandingPage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LandingPage_productId_key" ON "LandingPage"("productId");

-- AddForeignKey
ALTER TABLE "LandingPage" ADD CONSTRAINT "LandingPage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

