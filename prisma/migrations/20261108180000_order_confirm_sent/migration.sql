-- When the confirmation message was sent on WhatsApp: the new order waits for the customer's reply.
ALTER TABLE "Order" ADD COLUMN "confirmSentAt" TIMESTAMP(3);
