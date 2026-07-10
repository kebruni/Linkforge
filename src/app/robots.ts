import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const base = env.APP_URL.replace(/\/$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/u/"],
        disallow: ["/dashboard", "/admin", "/api/", "/login", "/register", "/verify"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
