-- Giveaways drawn live, and the people who entered them.
-- CreateTable
CREATE TABLE "Giveaway" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "prizeAr" TEXT NOT NULL,
    "prizeEn" TEXT NOT NULL,
    "detailsAr" TEXT,
    "detailsEn" TEXT,
    "image" TEXT,
    "productId" TEXT,
    "prizeValue" INTEGER,
    "drawAt" TIMESTAMP(3) NOT NULL,
    "liveUrl" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "drawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Giveaway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiveawayEntry" (
    "id" TEXT NOT NULL,
    "giveawayId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "marketing" BOOLEAN NOT NULL DEFAULT false,
    "ip" TEXT,
    "winnerRank" INTEGER,
    "drawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiveawayEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Giveaway_slug_key" ON "Giveaway"("slug");

-- CreateIndex
CREATE INDEX "Giveaway_isPublished_drawAt_idx" ON "Giveaway"("isPublished", "drawAt");

-- CreateIndex
CREATE INDEX "GiveawayEntry_giveawayId_winnerRank_idx" ON "GiveawayEntry"("giveawayId", "winnerRank");

-- CreateIndex
CREATE UNIQUE INDEX "GiveawayEntry_giveawayId_phone_key" ON "GiveawayEntry"("giveawayId", "phone");

-- AddForeignKey
ALTER TABLE "Giveaway" ADD CONSTRAINT "Giveaway_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiveawayEntry" ADD CONSTRAINT "GiveawayEntry_giveawayId_fkey" FOREIGN KEY ("giveawayId") REFERENCES "Giveaway"("id") ON DELETE CASCADE ON UPDATE CASCADE;
