-- CreateTable
CREATE TABLE "SupportLesson" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "productId" TEXT,
    "ticketId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "actor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportLesson_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportLesson_isActive_productId_idx" ON "SupportLesson"("isActive", "productId");

-- AddForeignKey
ALTER TABLE "SupportLesson" ADD CONSTRAINT "SupportLesson_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
