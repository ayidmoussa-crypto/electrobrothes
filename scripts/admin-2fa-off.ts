// Turn two-step login off for an account, when the phone and the backup codes are both lost:
//   npm run admin:2fa-off -- --email you@example.com
// Runs against the database in .env.local / .env (check NEON_BRANCH first). The next login asks for the
// password only; turn it on again from /admin/account.
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

config({ path: [".env.local", ".env"], quiet: true });

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  if (!email || !email.includes("@")) throw new Error("Usage: npm run admin:2fa-off -- --email you@example.com");
  const url = process.env.DATABASE_URL_UNPOOLED;
  if (!url) throw new Error("DATABASE_URL_UNPOOLED is not set (.env.local or .env).");
  console.log(`Database: ${new URL(url).host} (NEON_BRANCH=${process.env.NEON_BRANCH ?? "?"})`);

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const { count } = await db.adminUser.updateMany({
      where: { email },
      data: { totpSecret: null, totpEnabledAt: null, totpLastStep: null, totpBackupCodes: [] },
    });
    console.log(count ? `Two-step login is off for ${email}.` : `No account with the email ${email}.`);
    if (!count) process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
