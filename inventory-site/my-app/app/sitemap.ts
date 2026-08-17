import type { MetadataRoute } from "next";

const SITE_URL = "https://www.packaging.team";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/login`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}