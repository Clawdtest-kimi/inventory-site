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
const os = require('os');

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
    
    // ── GUARD: Don't overwrite newer data with older email ──
    if (fs.existsSync(DATA_FILE)) {
      try {
        const existing = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        const existingDate = new Date(existing.emailDate);
        const newDate = new Date(newest.date);
        if (newDate < existingDate) {
          console.log(`  ⏭️  Skipping: newest email (${newest.date}) is OLDER than current data (${existing.emailDate})`);
          console.log(`  ✅ Kept existing data: ${existing.totalReels} reels from ${existing.emailDate}`);
          await connection.end();
          return;
        }
      } catch (e) {
        // If we can't read existing data, proceed
      }
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
    
    // Save locally
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
    
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(stockJson, null, 2));
    console.log(`  ✓ Saved to ${DATA_FILE}`);
    
    // Also copy to public/ so Vercel serves it as static file
    const publicFile = path.join(__dirname, 'public', 'latest-stock.json');
    fs.mkdirSync(path.dirname(publicFile), { recursive: true });
    fs.copyFileSync(DATA_FILE, publicFile);
    console.log(`  ✓ Copied to public/latest-stock.json`);
    
    // Commit to GitHub and deploy to Vercel
    try {
      const status = execSync('git status --porcelain', { cwd: REPO_DIR, encoding: 'utf8' }).trim();
      
      if (status) {
        execSync(`git add inventory-site/my-app/data/latest-stock.json inventory-site/my-app/public/latest-stock.json`, { cwd: REPO_DIR });
        execSync(`git commit -m "data: auto-update from email - ${now} - ${totalReels} rolls"`, { cwd: REPO_DIR });
        execSync('git push origin main', { cwd: REPO_DIR, timeout: 30000 });
        console.log('  ✓ Committed & pushed to GitHub');
        
        // Deploy to Vercel: wait for git auto-deploy, then assign www.packaging.team alias
        try {
          const VERCEL_TOKEN = fs.readFileSync(path.join(os.homedir(), '.vercel', 'auth.json'), 'utf8');
          const tokenObj = JSON.parse(VERCEL_TOKEN);
          const vToken = tokenObj.token;
          const PROJECT_ID = 'prj_Tp8TpAUdoM6PJ090fVCNFaeItx4s';
          
          // Wait for Vercel to process the git push (auto-deploy triggers on push)
          console.log('  ⏳ Waiting for Vercel git auto-deploy...');
          await new Promise(r => setTimeout(r, 30000)); // 30s wait
          
          // Find the latest READY git deployment via API
          let aliasAssigned = false;
          for (let attempt = 0; attempt < 6 && !aliasAssigned; attempt++) {
            if (attempt > 0) {
              console.log(`  ⏳ Retry ${attempt}/5 — waiting for deployment to be READY...`);
              await new Promise(r => setTimeout(r, 15000)); // 15s between retries
            }
            
            const listResult = execSync(
              `/usr/bin/curl -s "https://api.vercel.com/v6/deployments?projectId=${PROJECT_ID}&limit=10&target=production" ` +
              `-H "Authorization: Bearer ${vToken}"`,
              { encoding: 'utf8', timeout: 15000 }
            );
            const listObj = JSON.parse(listResult);
            
            // Find latest READY git-source deployment
            const gitDep = (listObj.deployments || []).find(d => d.source === 'git' && d.readyState === 'READY');
            
            if (gitDep) {
              const depUrl = gitDep.url;  // Use URL, not UID — vercel alias set needs the URL
              console.log(`  ✓ Found git deployment: ${depUrl} (ID: ${gitDep.uid})`);
              
              // Assign www.packaging.team alias via Vercel CLI
              const vercelToken = process.env.VERCEL_TOKEN || vToken;
              const aliasResult = execSync(
                `/opt/homebrew/bin/vercel alias set ${depUrl} www.packaging.team --token "${vercelToken}" --scope sergius-projects-30adc328 2>&1`,
                { encoding: 'utf8', timeout: 30000 }
              );
              if (aliasResult.includes('Success')) {
                console.log(`  ✓ Alias assigned: www.packaging.team → ${depUrl}`);
                aliasAssigned = true;
              } else {
                console.log(`  ⚠️ Alias response: ${aliasResult.substring(0, 200)}`);
              }
            }
          }
          
          if (!aliasAssigned) {
            console.log('  ⚠️ Could not find READY git deployment after retries');
          }
        } catch (vercelError) {
          console.log('  ⚠️ Vercel alias failed:', vercelError.message.split('\n')[0]);
        }
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

// Thickness columns in order as they appear in the SRF stock email
const THICKNESS_KEYS = ['6.35', '7', '8', '9', '12', '37', '40'];

function parseStockTable(text) {
  // Decode quoted-printable
  let decoded = text
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  // Find HTML table
  const tableMatch = decoded.match(/<table[\s\S]*?<\/table>/i);
  if (!tableMatch) {
    return parsePlainTextTable(decoded);
  }

  const tableHtml = tableMatch[0];

  // Extract all rows from the table (both thead and tbody)
  const allRows = tableHtml.match(/<tr[\s\S]*?<\/tr>/gi);
  if (!allRows) {
    console.log('  ⚠️ No <tr> found in table');
    return [];
  }

  // Extract thickness headers from the first header row
  // Look for <th> with µ character
  const thicknessHeaders = [];
  const headerRow1Match = allRows[0].match(/<th[^>]*>([\s\S]*?)<\/th>/gi);
  if (headerRow1Match) {
    for (const th of headerRow1Match) {
      const text = th.replace(/<[^>]+>/g, '').trim();
      // Extract thickness value: "6.35µ" -> "6.35", "7µ" -> "7", "Total" -> skip, "Width (mm)" -> skip
      const m = text.match(/([\d.]+)\s*µ?/);
      if (m && !text.toLowerCase().includes('width') && !text.toLowerCase().includes('total')) {
        thicknessHeaders.push(m[1]);
      }
    }
  }

  // Use THICKNESS_KEYS as fallback if headers not found
  const thicknesses = thicknessHeaders.length > 0 ? thicknessHeaders : THICKNESS_KEYS;
  console.log(`  📐 Thicknesses: ${thicknesses.join(', ')}`);

  // Now extract all <td> cells from each body row
  const dataRows = [];
  const totalsRow = null;

  for (const rowHtml of allRows) {
    // Skip header rows (contain <th>)
    if (/<th/i.test(rowHtml)) continue;

    // Extract all <td> cell values
    const cellMatches = rowHtml.match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
    if (!cellMatches) continue;

    // Get text content of each cell
    const cells = cellMatches.map(td => {
      return td
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, '')
        .replace(/&amp;/g, '&')
        .trim();
    });

    // Check if this is the Total row (first cell is "Total")
    if (cells[0] && cells[0].toLowerCase().includes('total')) {
      // Parse totals row — cells: [Total, r, q, r, q, r, q, r, q, r, q, r, q, r, q, r, q]
      // 1 + 7*2 + 2 = 17 cells
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
      // Store totals in a property we'll return separately
      _totalsRow = { totalsByThickness, totalReels, totalQty };
      continue;
    }

    // Parse data row
    // cells[0] = width, cells[1..2] = first thickness reels/qty, etc., cells[15..16] = total
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

    dataRows.push({
      width,
      thicknesses: thicknessData,
      totalReels,
      totalQty
    });
    console.log(`    ✓ Width ${width}: ${totalReels} reels, ${totalQty} kg`);
  }

  return { thicknesses, dataRows, totals: _totalsRow };
}

// Global to capture totals row
let _totalsRow = null;

function parsePlainTextTable(text) {
  // Try to parse the plain-text fixed-width table
  const lines = text.split(/\r?\n/);

  // Find the header line with thickness values
  let thicknesses = THICKNESS_KEYS;
  let dataStartIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/Width\s*\(mm\)/i)) {
      // Extract thicknesses from this line
      const thicknessMatches = lines[i].match(/(\d+\.?\d*)\s*µ/g);
      if (thicknessMatches) {
        thicknesses = thicknessMatches.map(m => m.replace(/\s*µ/, ''));
      }
      dataStartIdx = i + 2; // Skip header + sub-header line
      break;
    }
  }

  if (dataStartIdx < 0) dataStartIdx = 0;

  const dataRows = [];
  _totalsRow = null;

  for (let i = dataStartIdx; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Check for Total row
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

    // Parse data row — first number is width, then pairs of reels/qty
    const numbers = line.match(/\b[\d,]+\b/g);
    if (!numbers || numbers.length < 3) continue;

    const cleanNumbers = numbers.map(n => parseInt(n.replace(/,/g, '')));
    const width = cleanNumbers[0];
    if (width < 200 || width > 2000) continue;

    // The rest are pairs: reels, qty for each thickness, then total reels, total qty
    const numThicknesses = thicknesses.length;
    const expectedNumbers = 1 + numThicknesses * 2 + 2; // width + thicknesses + total

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

    dataRows.push({
      width,
      thicknesses: thicknessData,
      totalReels,
      totalQty
    });
  }

  console.log(`  📊 Parsed ${dataRows.length} rows from plain text`);
  return { thicknesses, dataRows, totals: _totalsRow };
}

// ─── Run ───────────────────────────────────────────────────
main();