-- Offer pages: price from which the editorial template is suggested. One new column with a default.
-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "landingEditorialFrom" INTEGER NOT NULL DEFAULT 1500,
ALTER COLUMN "deliveryTimeAr" SET DEFAULT '2 إلى 5 أيام',
ALTER COLUMN "replacementPolicyAr" SET DEFAULT 'إلا وصلك المنتج فيه عطب، كنبدلوه ليك بمنتج جديد.';

