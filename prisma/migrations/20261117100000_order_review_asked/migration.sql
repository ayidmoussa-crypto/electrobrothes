-- AlterTable
-- When someone opened WhatsApp with the review request for a delivered order (sent by hand).
ALTER TABLE "Order" ADD COLUMN "reviewAskedAt" TIMESTAMP(3);
