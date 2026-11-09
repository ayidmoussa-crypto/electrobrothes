-- A parcel on its way back to the shop: refused at the door, the goods not in stock yet.
ALTER TYPE "OrderStatus" ADD VALUE 'RETURNING' AFTER 'DELIVERED';
