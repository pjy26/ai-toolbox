import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.amarapjy.xyz";
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api/",
        "/app",
        "/chat",
        "/dreams",
        "/insights",
        "/letters",
        "/memories",
        "/moments",
        "/people",
        "/settings",
        "/reset-password",
      ],
    },
    sitemap: new URL("/sitemap.xml", siteUrl).toString(),
  };
}
