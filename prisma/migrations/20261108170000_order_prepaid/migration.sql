-- An order paid before shipping: the carrier collects nothing at the door.
ALTER TABLE "Order" ADD COLUMN "prepaidAt" TIMESTAMP(3);
