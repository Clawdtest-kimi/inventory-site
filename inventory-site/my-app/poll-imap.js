#!/usr/bin/env node

/**
 * IMAP Poller for stock@packaging.team
 * 
 * Connects to mail.privateemail.com via IMAP,
 * finds the newest "Daily Report of Free Stock" email,
 * parses the stock table, saves to data/latest-stock.json,
 * and commits/pushes to GitHub.
 * 
 * Usage:
 *   node poll-imap.js          # Poll once
 *   node poll-imap.js --cron   # Run continuously (every 15 min)
 * 
 * Cron setup (every 15 minutes):
 *   star-slash-15 * * * * cd /Users/Apple/Desktop/Desktop_Mac_Mini_05JUN2026/inventory-site-github/inventory-site/my-app && /opt/homebrew/bin/node poll-imap.js >> /tmp/packaging-team-poller.log 2>&1
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '***';

const imaps = require('imap-simple');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { simpleParser } = require('mailparser');

// ─── Config ───────────────────────────────────────────────
const IMAP_CONFIG = {
  user: 'stock@packaging.team',
  password: 'Bucharest@2027',
  host: 'mail.privateemail.com',
  port: 993,
  tls: true,
  connTimeout: 30000,
  authTimeout: 30000,
  tlsOptions: { rejectUnauthorized: false }
};

const REPO_DIR = path.resolve(__dirname, '../..');  // Git repo root
const DATA_FILE = path.join(__dirname, 'data', 'latest-stock.json');

// Known widths from SRF Hungary stock reports
const KNOWN_WIDTHS = [565, 600, 700, 735, 760, 770, 780, 790, 820, 830, 850, 860, 865, 880, 885, 900, 920, 960, 970, 980, 990, 1000, 1010, 1020, 1050, 1067, 1070, 1080, 1090, 1116, 1120, 1140, 1160, 1180, 1200, 1210, 1220, 1250, 1445];

const POLL_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

// ─── Main ──────────────────────────────────────────────────
async function main() {
  const isCron = process.argv.includes('--cron');
  
  if (isCron) {
    console.log(`[${new Date().toISOString()}] Starting IMAP poller in cron mode (every 15 min)`);
    await pollOnce();
    setInterval(pollOnce, POLL_INTERVAL_MS);
  } else {
    await pollOnce();
  }
}

async function pollOnce() {
  const now = new Date().toISOString();
  console.log(`\n[${now}] Polling stock@packaging.team...`);
  
  try {
    const connection = await imaps.connect({
      imap: IMAP_CONFIG,
      onerror: (err) => console.error('IMAP Error:', err.message)
    });
    
    await connection.openBox('INBOX');
    console.log('  ✓ Connected to INBOX');
    
    // Search for stock report emails from last 30 days
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const dateStr = since.toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).replace(/,/g, '');
    
    const searchCriteria = [['SINCE', dateStr]];
    const fetchOptions = {
      bodies: ['HEADER', 'TEXT'],
      markSeen: false
    };
    
    let messages = await connection.search(searchCriteria, fetchOptions);
    console.log(`  📨 Found ${messages.length} emails from last 30 days`);
    
    // Filter for stock report emails
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
    
    // Sort newest first
    stockEmails.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    console.log(`  📊 Found ${stockEmails.length} stock report emails`);
    
    if (stockEmails.length === 0) {
      console.log('  ⚠️ No stock report emails found');
      await connection.end();
      return;
    }
    
    // Process the newest email
    const newest = stockEmails[0];
    console.log(`\n  📧 Processing newest: ${newest.subject}`);
    console.log(`     From: ${newest.from}`);
    console.log(`     Date: ${newest.date}`);
    
    const stockData = parseStockTable(newest.text);
    
    if (stockData.length === 0) {
      console.log('  ⚠️ No stock table found in email');
      await connection.end();
      return;
    }
    
    const totalReels = stockData.reduce((sum, r) => sum + (r.totalReels || 0), 0);
    const totalQty = stockData.reduce((sum, r) => sum + (r.totalQty || 0), 0);
    console.log(`  ✅ Parsed ${stockData.length} rows — ${totalReels} reels, ${totalQty} kg total`);
    
    // Save locally
    const stockJson = {
      timestamp: now,
      subject: newest.subject,
      from: newest.from,
      emailDate: newest.date,
      totalReels,
      totalQty,
      data: stockData
    };
    
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(stockJson, null, 2));
    console.log(`  ✓ Saved to ${DATA_FILE}`);
    
    // Commit to GitHub
    try {
      // Check if there are changes
      const status = execSync('git status --porcelain', { cwd: REPO_DIR, encoding: 'utf8' }).trim();
      
      if (status) {
        execSync(`git add inventory-site/my-app/data/latest-stock.json`, { cwd: REPO_DIR });
        execSync(`git commit -m "data: auto-update from email - ${now} - ${totalReels} rolls"`, { cwd: REPO_DIR });
        execSync('git push origin main', { cwd: REPO_DIR, timeout: 30000 });
        console.log('  ✓ Committed & pushed to GitHub');
      } else {
        console.log('  ℹ️ No changes to commit (data unchanged)');
      }
    } catch (gitError) {
      console.log('  ⚠️ Git push failed:', gitError.message.split('\n')[0]);
    }
    
    await connection.end();
    console.log(`\n[${now}] ✅ Done — ${stockData.length} rows, ${totalReels} reels`);
    
  } catch (error) {
    console.error(`[${now}] ❌ Error:`, error.message);
    if (process.env.DEBUG) console.error(error.stack);
  }
}

// ─── Parser ───────────────────────────────────────────────
function parseStockTable(text) {
  const rows = [];
  
  // Decode quoted-printable
  let decoded = text
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  
  // Find table body
  const tbodyMatch = decoded.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) {
    // Try plain text table parsing
    return parsePlainTextTable(decoded);
  }
  
  const tbodyContent = tbodyMatch[1];
  const rowMatches = tbodyContent.match(/<tr[\s\S]*?<\/tr>/gi);
  if (!rowMatches) {
    console.log('  ⚠️ No table rows found in tbody');
    return rows;
  }
  
  console.log(`  📊 Found ${rowMatches.length} HTML table rows`);
  
  for (const rowHtml of rowMatches) {
    // Remove HTML tags, get text content
    const textContent = rowHtml
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Skip Total row
    if (textContent.toLowerCase().includes('total')) {
      continue;
    }
    
    // Extract all numbers
    const numbers = textContent.match(/\b[\d,]+\b/g);
    if (!numbers || numbers.length < 3) continue;
    
    // Clean numbers (remove commas)
    const cleanNumbers = numbers.map(n => parseInt(n.replace(/,/g, '')));
    
    // First number should be width
    const width = cleanNumbers[0];
    
    // Accept known widths OR any reasonable width (200-2000)
    if (width < 200 || width > 2000) continue;
    
    // Build row: last two numbers are total reels and total qty
    const totalReels = cleanNumbers[cleanNumbers.length - 2] || 0;
    const totalQty = cleanNumbers[cleanNumbers.length - 1] || 0;
    
    if (totalReels > 0 || totalQty > 0) {
      rows.push({ width, totalReels, totalQty });
      console.log(`    ✓ Width ${width}: ${totalReels} reels, ${totalQty} kg`);
    }
  }
  
  return rows;
}

function parsePlainTextTable(text) {
  const rows = [];
  const lines = text.split(/\r?\n/);
  
  for (const line of lines) {
    const numbers = line.match(/\b[\d,]+\b/g);
    if (!numbers || numbers.length < 3) continue;
    
    const cleanNumbers = numbers.map(n => parseInt(n.replace(/,/g, '')));
    const width = cleanNumbers[0];
    
    if (width < 200 || width > 2000) continue;
    if (line.toLowerCase().includes('total')) continue;
    
    const totalReels = cleanNumbers[cleanNumbers.length - 2] || 0;
    const totalQty = cleanNumbers[cleanNumbers.length - 1] || 0;
    
    if (totalReels > 0 || totalQty > 0) {
      rows.push({ width, totalReels, totalQty });
    }
  }
  
  if (rows.length > 0) {
    console.log(`  📊 Parsed ${rows.length} rows from plain text`);
  }
  
  return rows;
}

// ─── Run ───────────────────────────────────────────────────
main();