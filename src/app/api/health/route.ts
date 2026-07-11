import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let db = false;
  let redisOk = false;

  try {
    await prisma.$queryRaw`SELECT 1`;
    db = true;
  } catch {
    /* unhealthy */
  }

  try {
    await redis.ping();
    redisOk = true;
  } catch {
    /* unhealthy */
  }

  const ok = db && redisOk;

  // Minimal public payload — avoid leaking stack versions / uptime to the internet.
  // Detailed diagnostics only in non-production.
  if (env.NODE_ENV === "production") {
    return NextResponse.json({ ok }, { status: ok ? 200 : 503 });
  }

  return NextResponse.json(
    {
      ok,
      db,
      redis: redisOk,
      uptime: process.uptime(),
      version: process.env.npm_package_version ?? "0.0.0",
    },
    { status: ok ? 200 : 503 },
  );
}
