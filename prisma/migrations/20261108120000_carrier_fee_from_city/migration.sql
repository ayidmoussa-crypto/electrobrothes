-- The carrier's fee now comes from the city's delivery price; a refused parcel costs nothing.
ALTER TABLE "Settings"
  DROP COLUMN "defaultDeliveryCost",
  DROP COLUMN "defaultReturnCost";
