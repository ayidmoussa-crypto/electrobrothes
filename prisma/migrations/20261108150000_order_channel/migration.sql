-- Where the buyer came from (Instagram, TikTok, Google search, ads...).
ALTER TABLE "Order"
  ADD COLUMN "channel" TEXT,
  ADD COLUMN "channelDetail" TEXT;
