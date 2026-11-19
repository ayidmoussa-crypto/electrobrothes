-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "supportRewardDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "supportRewardPercent" INTEGER NOT NULL DEFAULT 10;

-- AlterTable
ALTER TABLE "SupportTicket" ADD COLUMN     "rewardCode" TEXT;
