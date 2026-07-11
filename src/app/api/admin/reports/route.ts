import { z } from "zod";

import { auth } from "@/auth";
import { errors, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return errors.unauthorized();
  if (session.user.role !== "ADMIN") return errors.forbidden();

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "OPEN";
  const take = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);

  const reports = await prisma.contentReport.findMany({
    where: status === "ALL" ? undefined : { status },
    orderBy: { createdAt: "desc" },
    take,
    include: {
      reporter: { select: { id: true, email: true, username: true } },
      reportedUser: { select: { id: true, email: true, username: true } },
    },
  });

  return ok(
    reports.map((r) => ({
      id: r.id,
      reason: r.reason,
      details: r.details,
      status: r.status,
      pageId: r.pageId,
      createdAt: r.createdAt.toISOString(),
      reporter: r.reporter,
      reportedUser: r.reportedUser,
    })),
  );
}

const patchSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["OPEN", "RESOLVED", "DISMISSED"]),
});

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) return errors.unauthorized();
  if (session.user.role !== "ADMIN") return errors.forbidden();

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return errors.badRequest("Invalid input");

  const row = await prisma.contentReport.update({
    where: { id: parsed.data.id },
    data: { status: parsed.data.status },
    select: { id: true, status: true },
  });
  return ok(row);
}
