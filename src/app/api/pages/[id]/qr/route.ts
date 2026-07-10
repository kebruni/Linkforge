import QRCode from "qrcode";

import { auth } from "@/auth";
import { errors, ok } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

export const runtime = "nodejs";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user) return errors.unauthorized();
  const { id } = await params;

  const page = await prisma.page.findFirst({
    where: { id, userId: session.user.id, deletedAt: null },
    select: { slug: true },
  });
  if (!page) return errors.notFound();

  const url = `${env.APP_URL.replace(/\/$/, "")}/u/${page.slug}`;
  const dataUrl = await QRCode.toDataURL(url, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 512,
    color: { dark: "#0A0A0A", light: "#FFFFFF" },
  });

  return ok({ url, dataUrl });
}
