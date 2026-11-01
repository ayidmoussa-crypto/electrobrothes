-- The owner's approval rule: generated content goes live with undo unless it needs approval.
ALTER TABLE "Settings" ALTER COLUMN "seoAutoApply" SET DEFAULT true;
UPDATE "Settings" SET "seoAutoApply" = true;
