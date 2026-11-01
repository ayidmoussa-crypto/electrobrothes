import { connection } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  // Always run at request time, never prerendered.
  await connection();
  const started = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ db: "ok", latencyMs: Date.now() - started });
  } catch (error) {
    console.error("health: database unreachable", error);
    return Response.json({ db: "error" }, { status: 503 });
  }
}
