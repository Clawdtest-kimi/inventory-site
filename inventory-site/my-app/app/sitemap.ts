import type { MetadataRoute } from "next";

const SITE_URL = "https://www.packaging.team";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  // Only public pages — /login and /master are excluded for security
  return [
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: "daily",
      priority: 1.0,
    },
  ];
}