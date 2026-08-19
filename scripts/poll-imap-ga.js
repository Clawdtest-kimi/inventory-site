#!/usr/bin/env node

/**
 * IMAP Poller for GitHub Actions
 * 
 * Connects to mail.privateemail.com via IMAP,
 * finds the newest stock report email,
 * parses the stock table, saves to public/latest-stock.json,
 * and commits to git (GitHub Actions handles the push).
 *
 * All credentials come from environment variables (GitHub Secrets):
 *   IMAP_USER, IMAP_PASSWORD, IMAP_HOST, IMAP_PORT
 *
 * Usage:
 *   node scripts/poll-imap-ga.js
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const imaps = require('imap-simple');
const fs = require('fs');
const path = require('path');
const { simpleParser } = require('mailparser');

// ─── Config from env ───────────────────────────────────────
const IMAP_CONFIG = {
  user: process.env.IMAP_USER || 'stock@packaging.team',
  password: process.env.IMAP_PASSWORD,
  host: process.env.IMAP_HOST || 'mail.privateemail.com',
  port: parseInt(process.env.IMAP_PORT || '993'),
  tls: true,
  connTimeout: 30000,
  authTimeout: 30000,
  tlsOptions: { rejectUnauthorized: false }
};

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC_FILE = path.join(REPO_ROOT, 'inventory-site', 'my-app', 'public', 'latest-stock.json');

// Known widths from SRF Hungary stock reports
const KNOWN_WIDTHS = [565, 600, 700, 730, 735, 760, 770, 780, 790, 820, 830, 850, 860, 865, 870, 880, 885, 900, 920, 930, 960, 970, 980, 990, 1000, 1010, 1015, 1020, 1030, 1050, 1067, 1070, 1080, 1090, 1116, 1120, 1140, 1150, 1160, 1175, 1180, 1200, 1210, 1215, 1220, 1250, 1445];

const THICKNESS_KEYS = ['6.35', '7', '8', '9', '12', '37', '40'];

// ─── Main ──────────────────────────────────────────────────
async function main() {
  const now = new Date().toISOString();
  console.log(`[${now}] Polling ${IMAP_CONFIG.user}@${IMAP_CONFIG.host}...`);

  if (!IMAP_CONFIG.password) {
    console.error('❌ IMAP_PASSWORD environment variable not set');
    process.exit(1);
  }

  try {
    const connection = await imaps.connect({
      imap: IMAP_CONFIG,
      onerror: (err) => console.error('IMAP Error:', err.message)
    });

    await connection.openBox('INBOX');
    console.log('  ✓ Connected to INBOX');

    const since = new Date();
    since.setDate(since.getDate() - 30);
    const dateStr = since.toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).replace(/,/g, '');

    const searchCriteria = [['SINCE', dateStr]];
    const fetchOptions = { bodies: ['HEADER', 'TEXT'], markSeen: false };

    let messages = await connection.search(searchCriteria, fetchOptions);
    console.log(`  📨 Found ${messages.length} emails from last 30 days`);

    const stockEmails = [];
    for (const msg of messages) {
      const headerPart = msg.parts.find(p => p.which === 'HEADER');
      const textPart = msg.parts.find(p => p.which === 'TEXT');
      if (!headerPart || !textPart) continue;

      const subject = headerPart.body.subject?.[0] || '';
      const from = headerPart.body.from?.[0] || '';
      const date = headerPart.body.date?.[0] || '';

      if (subject.toLowerCase().includes('stock') ||
          subject.toLowerCase().includes('inventory') ||
          subject.toLowerCase().includes('daily report') ||
          subject.toLowerCase().includes('aluminium foil')) {
        stockEmails.push({ subject, from, date, text: textPart.body, uid: msg.attributes.uid });
      }
    }

    stockEmails.sort((a, b) => new Date(b.date) - new Date(a.date));
    console.log(`  📊 Found ${stockEmails.length} stock report emails`);

    if (stockEmails.length === 0) {
      console.log('  ⚠️ No stock report emails found');
      await connection.end();
      return;
    }

    const newest = stockEmails[0];
    console.log(`\n  📧 Processing newest: ${newest.subject}`);
    console.log(`     From: ${newest.from}`);
    console.log(`     Date: ${newest.date}`);

    // Guard: Don't overwrite newer data with older email
    if (fs.existsSync(PUBLIC_FILE)) {
      try {
        const existing = JSON.parse(fs.readFileSync(PUBLIC_FILE, 'utf8'));
        const existingDate = new Date(existing.emailDate);
        const newDate = new Date(newest.date);
        if (newDate < existingDate) {
          console.log(`  ⏭️  Skipping: newest email (${newest.date}) is OLDER than current data (${existing.emailDate})`);
          console.log(`  ✅ Kept existing data: ${existing.totalReels} reels from ${existing.emailDate}`);
          await connection.end();
          return;
        }
      } catch (e) { /* proceed */ }
    }

    const parsed = parseStockTable(newest.text);

    if (!parsed || !parsed.dataRows || parsed.dataRows.length === 0) {
      console.log('  ⚠️ No stock table found in email');
      await connection.end();
      return;
    }

    const stockData = parsed.dataRows;
    const totalReels = parsed.totals?.totalReels || stockData.reduce((s, r) => s + (r.totalReels || 0), 0);
    const totalQty = parsed.totals?.totalQty || stockData.reduce((s, r) => s + (r.totalQty || 0), 0);
    console.log(`  ✅ Parsed ${stockData.length} rows — ${totalReels} reels, ${totalQty} kg total`);

    const stockJson = {
      timestamp: now,
      subject: newest.subject,
      from: newest.from,
      emailDate: newest.date,
      thicknesses: parsed.thicknesses,
      totalReels,
      totalQty,
      totals: parsed.totals,
      data: stockData
    };

    fs.mkdirSync(path.dirname(PUBLIC_FILE), { recursive: true });
    fs.writeFileSync(PUBLIC_FILE, JSON.stringify(stockJson, null, 2));
    console.log(`  ✓ Saved to ${PUBLIC_FILE}`);

    await connection.end();
    console.log(`\n[${now}] ✅ Done — ${stockData.length} rows, ${totalReels} reels`);

  } catch (error) {
    console.error(`[${now}] ❌ Error:`, error.message);
    if (process.env.DEBUG) console.error(error.stack);
    process.exit(1);
  }
}

// ─── Parser (same logic as poll-imap.js) ────────────────────

let _totalsRow = null;

function parseStockTable(text) {
  let decoded = text
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  const tableMatch = decoded.match(/<table[\s\S]*?<\/table>/i);
  if (!tableMatch) {
    return parsePlainTextTable(decoded);
  }

  const tableHtml = tableMatch[0];
  const allRows = tableHtml.match(/<tr[\s\S]*?<\/tr>/gi);
  if (!allRows) {
    console.log('  ⚠️ No <tr> found in table');
    return [];
  }

  const thicknessHeaders = [];
  const headerRow1Match = allRows[0].match(/<th[^>]*>([\s\S]*?)<\/th>/gi);
  if (headerRow1Match) {
    for (const th of headerRow1Match) {
      const text = th.replace(/<[^>]+>/g, '').trim();
      const m = text.match(/([\d.]+)\s*µ?/);
      if (m && !text.toLowerCase().includes('width') && !text.toLowerCase().includes('total')) {
        thicknessHeaders.push(m[1]);
      }
    }
  }

  const thicknesses = thicknessHeaders.length > 0 ? thicknessHeaders : THICKNESS_KEYS;
  console.log(`  📐 Thicknesses: ${thicknesses.join(', ')}`);

  const dataRows = [];
  _totalsRow = null;

  for (const rowHtml of allRows) {
    if (/<th/i.test(rowHtml)) continue;

    const cellMatches = rowHtml.match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
    if (!cellMatches) continue;

    const cells = cellMatches.map(td => {
      return td.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '').replace(/&amp;/g, '&').trim();
    });

    if (cells[0] && cells[0].toLowerCase().includes('total')) {
      const totalsByThickness = {};
      for (let i = 0; i < thicknesses.length; i++) {
        const baseIdx = 1 + i * 2;
        const reels = parseInt((cells[baseIdx] || '0').replace(/,/g, '')) || 0;
        const qty = parseInt((cells[baseIdx + 1] || '0').replace(/,/g, '')) || 0;
        totalsByThickness[thicknesses[i]] = { reels, qty };
      }
      const totalReels = parseInt((cells[15] || '0').replace(/,/g, '')) || 0;
      const totalQty = parseInt((cells[16] || '0').replace(/,/g, '')) || 0;
      console.log(`  📊 Totals row: ${totalReels} reels, ${totalQty} kg`);
      _totalsRow = { totalsByThickness, totalReels, totalQty };
      continue;
    }

    const width = parseInt((cells[0] || '0').replace(/,/g, '')) || 0;
    if (width < 200 || width > 2000) continue;

    const thicknessData = {};
    for (let i = 0; i < thicknesses.length; i++) {
      const baseIdx = 1 + i * 2;
      const reels = parseInt((cells[baseIdx] || '0').replace(/,/g, '')) || 0;
      const qty = parseInt((cells[baseIdx + 1] || '0').replace(/,/g, '')) || 0;
      thicknessData[thicknesses[i]] = { reels, qty };
    }

    const totalReels = parseInt((cells[15] || '0').replace(/,/g, '')) || 0;
    const totalQty = parseInt((cells[16] || '0').replace(/,/g, '')) || 0;

    dataRows.push({ width, thicknesses: thicknessData, totalReels, totalQty });
    console.log(`    ✓ Width ${width}: ${totalReels} reels, ${totalQty} kg`);
  }

  return { thicknesses, dataRows, totals: _totalsRow };
}

function parsePlainTextTable(text) {
  const lines = text.split(/\r?\n/);
  let thicknesses = THICKNESS_KEYS;
  let dataStartIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/Width\s*\(mm\)/i)) {
      const thicknessMatches = lines[i].match(/(\d+\.?\d*)\s*µ/g);
      if (thicknessMatches) {
        thicknesses = thicknessMatches.map(m => m.replace(/\s*µ/, ''));
      }
      dataStartIdx = i + 2;
      break;
    }
  }

  if (dataStartIdx < 0) dataStartIdx = 0;

  const dataRows = [];
  _totalsRow = null;

  for (let i = dataStartIdx; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.toLowerCase().startsWith('total')) {
      const numbers = line.match(/\b[\d,]+\b/g);
      if (numbers) {
        const cleanNumbers = numbers.map(n => parseInt(n.replace(/,/g, '')));
        const totalsByThickness = {};
        for (let j = 0; j < thicknesses.length; j++) {
          const baseIdx = j * 2;
          totalsByThickness[thicknesses[j]] = {
            reels: cleanNumbers[baseIdx] || 0,
            qty: cleanNumbers[baseIdx + 1] || 0
          };
        }
        _totalsRow = {
          totalsByThickness,
          totalReels: cleanNumbers[cleanNumbers.length - 2] || 0,
          totalQty: cleanNumbers[cleanNumbers.length - 1] || 0
        };
      }
      continue;
    }

    const numbers = line.match(/\b[\d,]+\b/g);
    if (!numbers || numbers.length < 3) continue;

    const cleanNumbers = numbers.map(n => parseInt(n.replace(/,/g, '')));
    const width = cleanNumbers[0];
    if (width < 200 || width > 2000) continue;

    const numThicknesses = thicknesses.length;
    const thicknessData = {};
    for (let j = 0; j < numThicknesses; j++) {
      const baseIdx = 1 + j * 2;
      thicknessData[thicknesses[j]] = {
        reels: cleanNumbers[baseIdx] || 0,
        qty: cleanNumbers[baseIdx + 1] || 0
      };
    }

    const totalReels = cleanNumbers[cleanNumbers.length - 2] || 0;
    const totalQty = cleanNumbers[cleanNumbers.length - 1] || 0;

    dataRows.push({ width, thicknesses: thicknessData, totalReels, totalQty });
  }

  console.log(`  📊 Parsed ${dataRows.length} rows from plain text`);
  return { thicknesses, dataRows, totals: _totalsRow };
}

// ─── Run ───────────────────────────────────────────────────
main();