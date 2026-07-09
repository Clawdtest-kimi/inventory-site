import { NextResponse } from 'next/server';

const TELEGRAM_BOT_TOKEN = process.env["TELEGRAM_BOT_TOKEN"] || '';
const TELEGRAM_CHAT_ID = '6477833277';
const GIST_TOKEN = process.env["GIST_TOKEN"] || '';
const GIST_ID = process.env.GIST_ID || '';

// Rate limiting: 1 notification per IP per 5 minutes
const RATE_LIMIT_MS = 5 * 60 * 1000;
const visitorCache = new Map<string, number>();

interface VisitorLog {
  ip: string;
  time: string;
  device?: string;
  browser?: string;
  country?: string;
  city?: string;
  region?: string;
  referer?: string;
}

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

async function logToGist(entry: VisitorLog) {
  if (!GIST_TOKEN || !GIST_ID) {
    console.error('GIST_TOKEN or GIST_ID not set');
    return;
  }

  try {
    // Fetch current log
    const resp = await fetch(
      `https://api.github.com/gists/${GIST_ID}`,
      {
        headers: {
          Authorization: `Bearer ${GIST_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );
    const gist = await resp.json();
    const file = gist.files?.['visitor-log.json'];
    if (!file) return;

    const content = JSON.parse(file.content || '{"visitors":[],"total":0}');
    const visitors: VisitorLog[] = content.visitors || [];
    
    // Add new entry
    visitors.push(entry);
    
    // Keep last 500 entries
    const trimmed = visitors.slice(-500);

    const updatedContent = JSON.stringify({
      visitors: trimmed,
      total: visitors.length,
      lastUpdated: new Date().toISOString(),
    }, null, 2);

    // Update gist
    await fetch(
      `https://api.github.com/gists/${GIST_ID}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${GIST_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: {
            'visitor-log.json': {
              content: updatedContent,
            },
          },
        }),
      }
    );
  } catch (err) {
    console.error('Failed to log to gist:', err);
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
  const logEntry: VisitorLog = {
    ip,
    time: new Date().toISOString(),
  };

  const ua = headers.get('user-agent');
  if (ua) {
    let device = 'Desktop';
    if (/Mobile|Android|iPhone/.test(ua)) device = 'Mobile';
    if (/iPad|Tablet/.test(ua)) device = 'Tablet';
    extra['Device'] = device;
    logEntry.device = device;

    let browser = 'Unknown';
    if (/Chrome\/(\d+)/.test(ua) && !/Edg/.test(ua)) browser = 'Chrome';
    else if (/Firefox\/(\d+)/.test(ua)) browser = 'Firefox';
    else if (/Safari\/(\d+)/.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';
    else if (/Edg\/(\d+)/.test(ua)) browser = 'Edge';
    extra['Browser'] = browser;
    logEntry.browser = browser;
  }

  const referer = headers.get('referer');
  if (referer && !referer.includes('packaging.team')) {
    extra['Referer'] = referer;
    logEntry.referer = referer;
  }

  const country = headers.get('x-vercel-ip-country');
  if (country) {
    extra['Country'] = country;
    logEntry.country = country;
  }

  const city = headers.get('x-vercel-ip-city');
  if (city) {
    try {
      const decoded = decodeURIComponent(city);
      extra['City'] = decoded;
      logEntry.city = decoded;
    } catch {
      extra['City'] = city;
      logEntry.city = city;
    }
  }

  const region = headers.get('x-vercel-ip-country-region');
  if (region) {
    extra['Region'] = region;
    logEntry.region = region;
  }

  // Send Telegram notification and log to Gist (await both)
  await sendTelegramNotification(ip, extra);
  await logToGist(logEntry);

  return new NextResponse('ok', { status: 200 });
}