import type { MetadataRoute } from "next";

const publicPages = [
  { path: "/", priority: 1 },
  { path: "/pricing", priority: 0.9 },
  { path: "/contact", priority: 0.6 },
  { path: "/privacy", priority: 0.4 },
  { path: "/terms", priority: 0.4 },
  { path: "/cancellation", priority: 0.4 },
  { path: "/content-policy", priority: 0.4 },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.amarapjy.xyz";
  return publicPages.map(({ path, priority }) => ({
    url: new URL(path, siteUrl).toString(),
    lastModified: new Date(),
    changeFrequency: path === "/" || path === "/pricing" ? "weekly" : "monthly",
    priority,
  }));
}
