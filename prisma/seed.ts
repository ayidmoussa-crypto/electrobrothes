// Idempotent demo seed: safe to re-run, it upserts by slug / sku / code / city name.
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import ozonCities from "./cities-ozon.json";
import { brands, categories, coupons, DELIVERY_DAYS, mainCitiesAr, products, retired, reviews, shippingFeeFor } from "./seed-data";

config({ path: [".env.local", ".env"], quiet: true });

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL_UNPOOLED }),
});

const DAY = 24 * 60 * 60 * 1000;

async function main() {
  // Never seed demo data into production by accident.
  if (process.env.NEON_BRANCH === "production" && !process.argv.includes("--force-production")) {
    throw new Error("Refusing to seed the production branch. Run on the dev branch (neon checkout dev).");
  }

  // Drop old demo products; their categories/brands go once the kept products have moved out.
  await db.product.deleteMany({ where: { slug: { in: retired.products } } });

  const categoryIds: Record<string, string> = {};
  for (const [i, c] of categories.entries()) {
    const row = await db.category.upsert({
      where: { slug: c.slug },
      create: { ...c, sortOrder: i },
      update: { ...c, sortOrder: i },
    });
    categoryIds[c.slug] = row.id;
  }

  const brandIds: Record<string, string> = {};
  for (const b of brands) {
    const row = await db.brand.upsert({ where: { slug: b.slug }, create: b, update: b });
    brandIds[b.slug] = row.id;
  }

  for (const p of products) {
    const category = categories.find((c) => c.slug === p.category)!;
    const data = {
      nameAr: p.nameAr,
      nameEn: p.nameEn,
      descriptionAr: p.descriptionAr,
      descriptionEn: p.descriptionEn,
      warrantyMonths: p.warrantyMonths,
      isFeatured: p.isFeatured ?? false,
      isBestSeller: p.isBestSeller ?? false,
      dealEndsAt: p.dealDays ? new Date(Date.now() + p.dealDays * DAY) : null,
      categoryId: categoryIds[p.category],
      brandId: brandIds[p.brand],
    };

    await db.$transaction(async (tx) => {
      const product = await tx.product.upsert({
        where: { slug: p.slug },
        create: { slug: p.slug, ...data },
        update: data,
      });

      // Children are replaced wholesale; variants are upserted by SKU so order history keeps its links.
      await tx.productImage.deleteMany({ where: { productId: product.id } });
      await tx.spec.deleteMany({ where: { productId: product.id } });
      await tx.review.deleteMany({ where: { productId: product.id } });

      await tx.productImage.create({
        data: { productId: product.id, url: category.image, altAr: p.nameAr, altEn: p.nameEn },
      });

      await tx.spec.createMany({
        data: p.specs.map(([key, valueAr, valueEn, numericValue], i) => ({
          productId: product.id,
          key,
          valueAr,
          valueEn,
          numericValue: numericValue ?? null,
          sortOrder: i,
        })),
      });

      for (const [i, v] of p.variants.entries()) {
        const variant = { ...v, productId: product.id, isDefault: i === 0, sortOrder: i };
        await tx.variant.upsert({ where: { sku: v.sku }, create: variant, update: variant });
      }

      const rows = reviews[p.slug] ?? [];
      if (rows.length) {
        await tx.review.createMany({
          data: rows.map(([authorName, city, rating, comment], i) => ({
            productId: product.id,
            authorName,
            city,
            rating,
            comment,
            createdAt: new Date(Date.now() - (i + 1) * 9 * DAY),
          })),
        });
      }
    });
  }

  await db.category.deleteMany({ where: { slug: { in: retired.categories }, products: { none: {} } } });
  await db.brand.deleteMany({ where: { slug: { in: retired.brands }, products: { none: {} } } });

  // Main cities first (in mainCitiesAr order), then the rest alphabetically. Cities no longer served are
  // hidden rather than deleted so past orders keep their city.
  const main = Object.keys(mainCitiesAr);
  const missing = main.filter((n) => !ozonCities.includes(n));
  if (missing.length) throw new Error(`Main cities not in cities-ozon.json: ${missing.join(", ")}`);
  const ordered = [...main, ...ozonCities.filter((n) => !mainCitiesAr[n])];
  await db.city.updateMany({ where: { nameEn: { notIn: ordered } }, data: { isActive: false } });
  // ~900 rows: one set-based upsert instead of a round trip per city.
  await db.$executeRaw`
    INSERT INTO "City" ("id", "nameEn", "nameAr", "shippingFee", "deliveryDays", "isActive", "sortOrder")
    SELECT gen_random_uuid()::text, n."nameEn", n."nameAr", n."fee", ${DELIVERY_DAYS}, true, n."ord"::int - 1
    FROM unnest(
      ${ordered}::text[],
      ${ordered.map((n) => mainCitiesAr[n] ?? n)}::text[],
      ${ordered.map(shippingFeeFor)}::int[]
    ) WITH ORDINALITY AS n("nameEn", "nameAr", "fee", "ord")
    ON CONFLICT ("nameEn") DO UPDATE SET
      "nameAr" = EXCLUDED."nameAr", "shippingFee" = EXCLUDED."shippingFee", "deliveryDays" = EXCLUDED."deliveryDays",
      "isActive" = true, "sortOrder" = EXCLUDED."sortOrder"`;

  for (const c of coupons) {
    await db.coupon.upsert({ where: { code: c.code }, create: c, update: c });
  }

  // Free delivery from 500 DH on a new shop; an existing row keeps what the admin set.
  await db.settings.upsert({ where: { id: 1 }, create: { id: 1, freeShippingThreshold: 500 }, update: {} });

  const counts = {
    categories: await db.category.count(),
    brands: await db.brand.count(),
    products: await db.product.count(),
    variants: await db.variant.count(),
    reviews: await db.review.count(),
    cities: await db.city.count(),
    coupons: await db.coupon.count(),
  };
  console.log("Seeded", counts);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
