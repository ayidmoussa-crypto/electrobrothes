-- Two-step login for the owner (optional): sealed authenticator key, last used step, hashed backup codes.
-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN     "totpBackupCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "totpEnabledAt" TIMESTAMP(3),
ADD COLUMN     "totpLastStep" INTEGER,
ADD COLUMN     "totpSecret" TEXT;
