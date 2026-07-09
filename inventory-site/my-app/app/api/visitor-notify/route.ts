import { NextResponse } from 'next/server';

const TELEGRAM_BOT_TOKEN=*** || '';
const TELEGRAM_CHAT_ID = '6477833277';

// Rate limiting: 1 notification per IP per 5 minutes
const RATE_LIMIT_MS = 5 * 60 * 1000;
const visitorCache = new Map<string, number>();

async function sendTelegramNotification(ip: string, extra: Record<string, string>) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN not set');
    return;
  }

  const timestamp = new Date().toISOString();
  const details = Object.entries(extra)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join('\n');

  const message = `🌐 New visitor on www.packaging.team\n\nIP: ${ip}\nTime: ${timestamp}\n${details}`;

  try {
    const resp = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: 'HTML',
        }),
      }
    );
    const data = await resp.json();
    if (!data.ok) {
      console.error('Telegram API error:', data.description);
    }
  } catch (err) {
    console.error('Failed to send Telegram notification:', err);
  }
}

function getIP(request: Request): string {
  const headers = request.headers;
  return (
    headers.get('x-real-ip') ||
    headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    headers.get('cf-connecting-ip') ||
    'unknown'
  );
}

export async function GET(request: Request) {
  const ip = getIP(request);
  const now = Date.now();

  // Rate limit: 1 notification per IP per 5 minutes
  const lastSeen = visitorCache.get(ip);
  if (lastSeen && now - lastSeen < RATE_LIMIT_MS) {
    return new NextResponse('ok', { status: 200 });
  }
  visitorCache.set(ip, now);

  // Clean old entries from cache
  for (const [key, time] of visitorCache.entries()) {
    if (now - time > RATE_LIMIT_MS * 2) {
      visitorCache.delete(key);
    }
  }

  // Gather visitor info
  const headers = request.headers;
  const extra: Record<string, string> = {};

  const ua = headers.get('user-agent');
  if (ua) {
    let device = 'Desktop';
    if (/Mobile|Android|iPhone|iPad/.test(ua)) device = 'Mobile';
    if (/iPad|Tablet/.test(ua)) device = 'Tablet';
    extra['Device'] = device;

    let browser = 'Unknown';
    if (/Chrome\/(\d+)/.test(ua) && !/Edg/.test(ua)) browser = 'Chrome';
    else if (/Firefox\/(\d+)/.test(ua)) browser = 'Firefox';
    else if (/Safari\/(\d+)/.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';
    else if (/Edg\/(\d+)/.test(ua)) browser = 'Edge';
    extra['Browser'] = browser;
  }

  const referer = headers.get('referer');
  if (referer && !referer.includes('packaging.team')) {
    extra['Referer'] = referer;
  }

  const country = headers.get('x-vercel-ip-country');
  if (country) extra['Country'] = country;

  const city = headers.get('x-vercel-ip-city');
  if (city) {
    try {
      extra['City'] = decodeURIComponent(city);
    } catch {
      extra['City'] = city;
    }
  }

  const region = headers.get('x-vercel-ip-country-region');
  if (region) extra['Region'] = region;

  // Send notification (fire and forget — don't block response)
  sendTelegramNotification(ip, extra);

  return new NextResponse('ok', { status: 200 });
}