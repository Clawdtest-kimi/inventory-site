import { NextRequest, NextResponse } from "next/server";

// ─── Visitor Notification API ─────────────────────────────────
// When a human visitor loads the page, the client-side tracker calls
// /api/visitor-notify. This route sends a Telegram message to Sergiu.
// Bots (Googlebot, etc.) are filtered out — only real humans trigger alerts.
// Silent fail — never affects the visitor's UX.

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

// Bot user-agent patterns — these are NOT real visitors
const BOT_PATTERNS = [
  /googlebot/i, /bingbot/i, /slurp/i, /duckduckbot/i, /baiduspider/i,
  /yandexbot/i, /sogou/i, /exabot/i, /facebot/i, /facebookexternalhit/i,
  /ia_archiver/i, /applebot/i, /twitterbot/i, /linkedinbot/i,
  /telegrambot/i, /discordbot/i, /whatsapp/i, /semrush/i, /ahrefs/i,
  /mj12bot/i, /dotbot/i, /bytespider/i, /petalbot/i, /gptbot/i,
  /claudebot/i, /perplexitybot/i, /amazonbot/i, /google-extended/i,
  /crawler/i, /spider/i, /bot\//i, /headless/i, /phantom/i, /selenium/i,
  /pingdom/i, /uptimerobot/i, /site24x7/i, /newrelic/i, /datadog/i,
  /vercel/i, /preview/i, /w3c/i, /checkmark/i, /validator/i,
];

// Track last notification time to avoid spam (min 60 seconds between alerts)
let lastNotifyTime = 0;
const MIN_NOTIFY_INTERVAL_MS = 60_000;
// Per-IP rate limiting — max 1 notification per 5 minutes per IP
const ipNotifyMap = new Map<string, number>();
const PER_IP_COOLDOWN_MS = 300_000;

export async function GET(request: NextRequest) {
  try {
    const userAgent = request.headers.get("user-agent") || "";
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
               request.headers.get("x-real-ip") || "unknown";
    const referer = request.headers.get("referer") || "direct";
    const acceptLang = request.headers.get("accept-language") || "";
    const country = request.headers.get("x-vercel-ip-country") || "?";
    const city = request.headers.get("x-vercel-ip-city") || "?";
    const countryCode = request.headers.get("x-vercel-ip-country-code") || "?";

    // Filter bots
    const isBot = BOT_PATTERNS.some(p => p.test(userAgent));
    if (isBot) {
      return NextResponse.json({ ok: true, bot: true }, { status: 200 });
    }

    // Rate-limit: don't spam if multiple requests come in quick succession
    const now = Date.now();
    if (now - lastNotifyTime < MIN_NOTIFY_INTERVAL_MS) {
      return NextResponse.json({ ok: true, rate_limited: true }, { status: 200 });
    }
    // Per-IP cooldown — block repeat spam from same IP
    const lastIpNotify = ipNotifyMap.get(ip);
    if (lastIpNotify && now - lastIpNotify < PER_IP_COOLDOWN_MS) {
      return NextResponse.json({ ok: true, rate_limited: true }, { status: 200 });
    }
    // Clean old entries from map (prevent memory leak)
    if (ipNotifyMap.size > 100) {
      for (const [key, val] of ipNotifyMap) {
        if (now - val > PER_IP_COOLDOWN_MS) ipNotifyMap.delete(key);
      }
    }
    lastNotifyTime = now;
    ipNotifyMap.set(ip, now);

    // Build visitor info
    const time = new Date().toISOString();
    const device = /mobile|android|iphone|ipad/i.test(userAgent) ? "📱 Mobile" : "💻 Desktop";
    const browser = detectBrowser(userAgent);
    const os = detectOS(userAgent);

    // Trim UA for privacy
    const uaShort = userAgent.length > 80 ? userAgent.substring(0, 80) + "…" : userAgent;

    const message = [
      "👁️ New visitor on packaging.team",
      "",
      `🕐 ${time}`,
      `🌍 ${city}, ${countryCode} (${country})`,
      `${device} · ${browser} · ${os}`,
      `🔗 From: ${referer !== "direct" ? referer : "direct/typed URL"}`,
      `🌐 IP: ${ip !== "unknown" ? ip.replace(/(\d+)\.(\d+)\.\d+\.\d+/, "$1.$2.x.x") : "unknown"}`,
    ].join("\n");

    // Send Telegram notification (fire and forget)
    if (TELEGRAM_BOT_TOKEN) {
      try {
        const tgUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        await fetch(tgUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
            disable_web_page_preview: true,
          }),
        });
      } catch {
        // Silent fail — don't affect visitor
      }
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}

function detectBrowser(ua: string): string {
  if (/edg/i.test(ua)) return "Edge";
  if (/chrome/i.test(ua)) return "Chrome";
  if (/firefox/i.test(ua)) return "Firefox";
  if (/safari/i.test(ua)) return "Safari";
  if (/opr|opera/i.test(ua)) return "Opera";
  return "Other";
}

function detectOS(ua: string): string {
  if (/windows/i.test(ua)) return "Windows";
  if (/mac os|macintosh/i.test(ua)) return "macOS";
  if (/android/i.test(ua)) return "Android";
  if (/iphone|ipad|ios/i.test(ua)) return "iOS";
  if (/linux/i.test(ua)) return "Linux";
  return "Other";
}