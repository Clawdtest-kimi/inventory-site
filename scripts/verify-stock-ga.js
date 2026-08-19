#!/usr/bin/env node

/**
 * Stock Verifier for GitHub Actions
 * 
 * Fetches latest-stock.json from the live website,
 * compares with the committed file in the repo,
 * and sends a Telegram alert if anything is wrong.
 *
 * Environment variables (GitHub Secrets):
 *   TELEGRAM_BOT_TOKEN — Telegram bot token
 *   TELEGRAM_CHAT_ID   — Chat ID to send alerts to
 *
 * Usage:
 *   node scripts/verify-stock-ga.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const SITE_URL = 'https://www.packaging.team/api/stock';
const LOCAL_FILE = path.resolve(__dirname, '..', 'inventory-site', 'my-app', 'public', 'latest-stock.json');

// Fetch from the dynamic API route (no CDN cache issues)
const MAX_AGE_HOURS = 24;
const MAX_EMAIL_AGE_DAYS = 3;

// ─── Telegram ──────────────────────────────────────────────
async function sendTelegram(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.error('⚠️  TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set — cannot send alert');
    console.error('Alert message:');
    console.error(message);
    return;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = JSON.stringify({
    chat_id: chatId,
    text: message,
    parse_mode: 'HTML',
    disable_web_page_preview: true
  });

  return new Promise((resolve) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('  ✓ Telegram alert sent');
        } else {
          console.error(`  ⚠️ Telegram API returned ${res.statusCode}: ${data.substring(0, 200)}`);
        }
        resolve();
      });
    });

    req.on('error', (err) => {
      console.error('  ⚠️ Telegram send failed:', err.message);
      resolve();
    });

    req.write(body);
    req.end();
  });
}

// ─── HTTP GET (JSON) ───────────────────────────────────────
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 15000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Invalid JSON from ${url}: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error(`Timeout fetching ${url}`));
    });
  });
}

// ─── Main ──────────────────────────────────────────────────
async function main() {
  const now = new Date().toISOString();
  console.log(`[${now}] Verifying packaging.team stock sync...`);

  const alerts = [];

  // 1. Fetch website JSON
  let webData;
  try {
    console.log(`  🌐 Fetching ${SITE_URL}...`);
    webData = await fetchJson(SITE_URL);
    console.log(`  ✓ Website responded`);
  } catch (err) {
    const msg = `🚨 PACKAGING.TEAM VERIFY ALERT\n\n❌ Website unreachable or invalid JSON\n   URL: ${SITE_URL}\n   Error: ${err.message}\n   Time: ${now}`;
    console.error(msg);
    await sendTelegram(msg);
    process.exit(3);
  }

  const webReels = webData.totals?.totalReels || webData.totalReels || '?';
  const webQty = webData.totals?.totalQty || webData.totalQty || '?';
  const webTs = webData.timestamp || webData.updatedAt || '?';
  const webEmailDate = webData.emailDate || webData.email_date || '?';

  // 2. Load local file
  let localData;
  if (fs.existsSync(LOCAL_FILE)) {
    localData = JSON.parse(fs.readFileSync(LOCAL_FILE, 'utf8'));
  } else {
    alerts.push(`❌ Local latest-stock.json not found at ${LOCAL_FILE}`);
    localData = {};
  }

  const localReels = localData.totals?.totalReels || localData.totalReels || '?';
  const localQty = localData.totals?.totalQty || localData.totalQty || '?';
  const localEmailDate = localData.emailDate || localData.email_date || '?';

  // 3. Compare reel counts
  if (webReels !== localReels) {
    alerts.push(`🚨 REEL COUNT MISMATCH: Website=${webReels} vs Email=${localReels}`);
  }

  // 4. Compare quantities
  if (webQty !== localQty) {
    alerts.push(`⚠️  QTY MISMATCH: Website=${webQty} vs Email=${localQty}`);
  }

  // 5. Compare email dates
  if (webEmailDate !== localEmailDate && localEmailDate !== '?') {
    alerts.push(`⚠️  EMAIL DATE MISMATCH: Website=${webEmailDate} vs Local=${localEmailDate}`);
  }

  // 6. Data freshness
  if (webTs !== '?') {
    const ageHours = (Date.now() - new Date(webTs.replace('Z', '+00:00')).getTime()) / 3600000;
    if (isNaN(ageHours)) {
      alerts.push(`⚠️  Cannot parse website timestamp: ${webTs}`);
    } else if (ageHours > MAX_AGE_HOURS) {
      alerts.push(`⏰ STALE DATA: Website data is ${ageHours.toFixed(1)}h old (limit: ${MAX_AGE_HOURS}h)`);
    } else {
      console.log(`  ✓ Data freshness OK: ${ageHours.toFixed(1)}h old`);
    }
  }

  // 7. Email source age
  if (webEmailDate !== '?' && webEmailDate !== 'unknown') {
    try {
      const emailDate = new Date(webEmailDate);
      const emailAgeDays = Math.floor((Date.now() - emailDate.getTime()) / 86400000);
      if (emailAgeDays > MAX_EMAIL_AGE_DAYS) {
        alerts.push(`📧 STALE EMAIL: Source email is ${emailAgeDays} days old (limit: ${MAX_EMAIL_AGE_DAYS}d)`);
      } else {
        console.log(`  ✓ Email age OK: ${emailAgeDays} days old`);
      }
    } catch (e) {
      // can't parse, skip
    }
  }

  // ─── Output ────────────────────────────────────────────
  if (alerts.length > 0) {
    const msg = `🚨 PACKAGING.TEAM VERIFY ALERT\n\nTime: ${now}\nWebsite: ${webReels} reels, ${webQty} kg\nEmail:   ${localReels} reels, ${localQty} kg\nWebsite timestamp: ${webTs}\nEmail date:        ${webEmailDate}\n\n${alerts.join('\n')}`;
    console.error(msg);
    await sendTelegram(msg);
    process.exit(1);
  }

  // All good — silent
  console.log(`  ✅ All checks passed: ${webReels} reels, ${webQty} kg — silent`);
}

main().catch(async (err) => {
  const msg = `🚨 PACKAGING.TEAM VERIFY — UNEXPECTED ERROR\n\n${err.message}\n\nTime: ${new Date().toISOString()}`;
  console.error(msg);
  await sendTelegram(msg);
  process.exit(2);
});