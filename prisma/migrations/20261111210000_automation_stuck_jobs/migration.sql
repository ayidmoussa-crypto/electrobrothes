-- Jobs stuck in SENDING: when a run took the job and when the call to Meta began, and a status for the
-- ones a person must check (lib/automation-rules.ts stuckJobOutcome).
-- AlterEnum
ALTER TYPE "AutomationJobStatus" ADD VALUE 'NEEDS_REVIEW';

-- AlterTable
ALTER TABLE "AutomationJob" ADD COLUMN     "claimedAt" TIMESTAMP(3),
ADD COLUMN     "sendStartedAt" TIMESTAMP(3);
