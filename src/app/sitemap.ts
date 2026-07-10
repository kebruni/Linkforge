import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.APP_URL.replace(/\/$/, "");

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${base}/login`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/register`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
  ];

  try {
    const pages = await prisma.page.findMany({
      where: { isPublished: true, deletedAt: null, isPrivate: false },
      select: { slug: true, updatedAt: true },
      take: 50_000,
      orderBy: { updatedAt: "desc" },
    });

    const publicPages: MetadataRoute.Sitemap = pages.map((p) => ({
      url: `${base}/u/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "daily",
      priority: 0.8,
    }));

    return [...staticRoutes, ...publicPages];
  } catch {
    return staticRoutes;
  }
}
