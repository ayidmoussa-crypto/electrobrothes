-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "deliveryTimeAr" TEXT NOT NULL DEFAULT '2 إلى 5 أيام',
ADD COLUMN     "deliveryTimeEn" TEXT NOT NULL DEFAULT '2 to 5 days',
ADD COLUMN     "replacementPolicyAr" TEXT NOT NULL DEFAULT 'إلا وصلك المنتج فيه عطب، كنبدلوه ليك بمنتج جديد.',
ADD COLUMN     "replacementPolicyEn" TEXT NOT NULL DEFAULT 'If your product arrives defective, we replace it with a new one.';
