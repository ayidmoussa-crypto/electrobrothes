import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

// `neon deploy` writes .env.local; .env is the fallback on a VPS.
config({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // Migrations must use the direct (non -pooler) connection.
  datasource: {
    url: env("DATABASE_URL_UNPOOLED"),
  },
});
