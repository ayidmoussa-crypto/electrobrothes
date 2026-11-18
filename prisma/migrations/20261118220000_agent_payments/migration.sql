-- What the owner paid each confirmation agent. Adds one table; nothing existing changes.
-- CreateTable
CREATE TABLE "AgentPayment" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "confirmedCount" INTEGER NOT NULL,
    "deliveredCount" INTEGER NOT NULL,
    "actor" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentPayment_expenseId_key" ON "AgentPayment"("expenseId");

-- CreateIndex
CREATE INDEX "AgentPayment_agentId_paidAt_idx" ON "AgentPayment"("agentId", "paidAt");

-- AddForeignKey
ALTER TABLE "AgentPayment" ADD CONSTRAINT "AgentPayment_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentPayment" ADD CONSTRAINT "AgentPayment_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;
