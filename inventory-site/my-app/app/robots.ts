import type { MetadataRoute } from "next";

const SITE_URL = "https://www.packaging.team";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        // Major search engines
        userAgent: "Googlebot",
        allow: "/",
        disallow: ["/api/", "/login", "/master", "/imap-config"],
      },
      {
        userAgent: "Bingbot",
        allow: "/",
        disallow: ["/api/", "/login", "/master", "/imap-config"],
      },
      {
        userAgent: "DuckDuckBot",
        allow: "/",
        disallow: ["/api/", "/login", "/master", "/imap-config"],
      },
      {
        userAgent: "YandexBot",
        allow: "/",
        disallow: ["/api/", "/login", "/master", "/imap-config"],
      },
      {
        userAgent: "Baiduspider",
        allow: "/",
        disallow: ["/api/", "/login", "/master", "/imap-config"],
      },
      {
        // AI engines / LLM crawlers — allow full access for indexing
        userAgent: "GPTBot",
        allow: "/",
        disallow: ["/api/", "/login", "/master", "/imap-config"],
      },
      {
        userAgent: "ChatGPT-User",
        allow: "/",
        disallow: ["/api/", "/login", "/master", "/imap-config"],
      },
      {
        userAgent: "ClaudeBot",
        allow: "/",
        disallow: ["/api/", "/login", "/master", "/imap-config"],
      },
      {
        userAgent: "Claude-Web",
        allow: "/",
        disallow: ["/api/", "/login", "/master", "/imap-config"],
      },
      {
        userAgent: "anthropic-ai",
        allow: "/",
        disallow: ["/api/", "/login", "/master", "/imap-config"],
      },
      {
        userAgent: "PerplexityBot",
        allow: "/",
        disallow: ["/api/", "/login", "/master", "/imap-config"],
      },
      {
        userAgent: "Perplexity-User",
        allow: "/",
        disallow: ["/api/", "/login", "/master", "/imap-config"],
      },
      {
        userAgent: "Google-Extended",
        allow: "/",
        disallow: ["/api/", "/login", "/master", "/imap-config"],
      },
      {
        userAgent: "Applebot",
        allow: "/",
        disallow: ["/api/", "/login", "/master", "/imap-config"],
      },
      {
        userAgent: "Applebot-Extended",
        allow: "/",
        disallow: ["/api/", "/login", "/master", "/imap-config"],
      },
      {
        userAgent: "Amazonbot",
        allow: "/",
        disallow: ["/api/", "/login", "/master", "/imap-config"],
      },
      {
        userAgent: "Cotoyogi",
        allow: "/",
        disallow: ["/api/", "/login", "/master", "/imap-config"],
      },
      {
        userAgent: "FacebookBot",
        allow: "/",
        disallow: ["/api/", "/login", "/master", "/imap-config"],
      },
      {
        userAgent: "LinkedInBot",
        allow: "/",
        disallow: ["/api/", "/login", "/master", "/imap-config"],
      },
      {
        // Catch-all for all other bots
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/login", "/master", "/imap-config"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: "www.packaging.team",
  };
}