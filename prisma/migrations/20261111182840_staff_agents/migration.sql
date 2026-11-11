-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('OWNER', 'AGENT');

-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "payPerConfirmed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "payPerDelivered" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "role" "AdminRole" NOT NULL DEFAULT 'OWNER';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "handledAs" "OrderStatus",
ADD COLUMN     "handledAt" TIMESTAMP(3),
ADD COLUMN     "handledById" TEXT;

-- CreateIndex
CREATE INDEX "Order_handledById_handledAt_idx" ON "Order"("handledById", "handledAt");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
