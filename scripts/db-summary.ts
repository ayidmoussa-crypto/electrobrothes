// Quick look at what is in the current Neon branch: npm run db:summary
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

config({ path: [".env.local", ".env"], quiet: true });
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  const skus = (rows: { sku: string }[]) => rows.map((r) => r.sku).join(", ") || "—";
  const cats = await db.category.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { sortOrder: "asc" },
  });

  console.log("branch:", process.env.NEON_BRANCH);
  console.log("products per category:", cats.map((c) => `${c.slug}=${c._count.products}`).join(", "));
  console.log("out of stock:", skus(await db.variant.findMany({ where: { stock: 0 }, select: { sku: true } })));
  console.log("low stock (1-2):", skus(await db.variant.findMany({ where: { stock: { gte: 1, lte: 2 } }, select: { sku: true } })));
  console.log(
    "limited deals:",
    (await db.product.findMany({ where: { dealEndsAt: { gt: new Date() } }, select: { slug: true } })).map((p) => p.slug).join(", "),
  );
  console.log("orders:", await db.order.count());
}

main().finally(() => db.$disconnect());
