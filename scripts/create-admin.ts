// Create or reset an admin account:
//   npm run admin:create -- --email you@example.com --password "a long passphrase" --name "Your name"
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/password";

config({ path: [".env.local", ".env"], quiet: true });

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  const password = arg("password");
  const name = arg("name") ?? "Admin";
  if (!email || !email.includes("@") || !password || password.length < 12) {
    throw new Error('Usage: npm run admin:create -- --email you@example.com --password "at least 12 characters" [--name "Name"]');
  }
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL_UNPOOLED }) });
  const passwordHash = await hashPassword(password);
  await db.adminUser.upsert({ where: { email }, create: { email, name, passwordHash }, update: { name, passwordHash } });
  console.log(`Admin ready: ${email}`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
