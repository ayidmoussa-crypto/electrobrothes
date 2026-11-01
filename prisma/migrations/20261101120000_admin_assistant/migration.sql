-- CreateEnum
CREATE TYPE "AssistantActionKind" AS ENUM ('STOCK_CHANGE', 'DRAFT_PRODUCT');

-- CreateEnum
CREATE TYPE "AssistantActionStatus" AS ENUM ('PENDING', 'APPLIED', 'CANCELLED', 'EXPIRED', 'UNDONE');

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "assistantBudgetCents" INTEGER NOT NULL DEFAULT 500;

-- CreateTable
CREATE TABLE "AssistantAction" (
    "id" TEXT NOT NULL,
    "kind" "AssistantActionKind" NOT NULL,
    "status" "AssistantActionStatus" NOT NULL DEFAULT 'PENDING',
    "summary" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "undo" JSONB,
    "photo" TEXT,
    "model" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "decidedBy" TEXT,
    "undoneBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "undoneAt" TIMESTAMP(3),

    CONSTRAINT "AssistantAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantUsage" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheWriteTokens" INTEGER NOT NULL DEFAULT 0,
    "costMicros" INTEGER NOT NULL,
    "actor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssistantAction_status_createdAt_idx" ON "AssistantAction"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AssistantAction_createdAt_idx" ON "AssistantAction"("createdAt");

-- CreateIndex
CREATE INDEX "AssistantUsage_month_idx" ON "AssistantUsage"("month");
