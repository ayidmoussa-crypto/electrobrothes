-- Home page hero: the product of the week and an optional title. Only new, empty columns.
ALTER TABLE "Settings" ADD COLUMN "heroProductId" TEXT,
ADD COLUMN "heroHeadlineAr" TEXT,
ADD COLUMN "heroHeadlineEn" TEXT;

ALTER TABLE "Settings" ADD CONSTRAINT "Settings_heroProductId_fkey" FOREIGN KEY ("heroProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
