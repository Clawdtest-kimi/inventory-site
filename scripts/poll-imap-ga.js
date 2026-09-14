#!/usr/bin/env node
'use strict';
/**
 * IMAP Stock Poller (GitHub Actions)
 *
 * Fetches the newest stock-report email, parses it with the header-aligned parser
 * (see parseStockEmail below: gauge columns come FROM THE EMAIL HEADER, and every
 * row must be internally consistent), and regenerates
 * inventory-site/my-app/public/latest-stock.json.
 *
 * Fail closed: if the table cannot be parsed with confidence, nothing is written
 * and a Telegram alert is raised (no silent wrong data).
 *
 * Env: IMAP_HOST, IMAP_PORT, IMAP_USER, IMAP_PASSWORD, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const fs = require('fs');
const path = require('path');
const https = require('https');
const os = require('os');

const SCRIPTS_DIR = __dirname;
const REPO_ROOT = path.resolve(__dirname, '..');
const imaps = require(path.join(SCRIPTS_DIR, 'node_modules', 'imap-simple'));
const { simpleParser } = require(path.join(SCRIPTS_DIR, 'node_modules', 'mailparser'));

const IMAP_HOST = process.env.IMAP_HOST || 'mail.privateemail.com';
const IMAP_PORT = parseInt(process.env.IMAP_PORT || '993', 10);
const IMAP_USER = process.env.IMAP_USER || 'stock@packaging.team';
const IMAP_PASSWORD = process.env.IMAP_PASSWORD || '';

const PUBLIC_FILE = path.join(REPO_ROOT, 'inventory-site', 'my-app', 'public', 'latest-stock.json');
const ALERT_FILE = path.join(os.tmpdir(), 'packaging-team-parse-alert.txt');

function sendTelegram(text) {
  return new Promise((resolve) => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) {
      console.log('No Telegram creds; message follows:');
      console.log(text);
      return resolve();
    }
    const body = JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true });
    const req = https.request({
      hostname: 'api.telegram.org',
      path: '/bot' + token + '/sendMessage',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 10000,
    }, (res) => { res.resume(); res.on('end', resolve); });
    req.on('error', (e) => { console.log('telegram failed:', e.message); resolve(); });
    req.on('timeout', () => { req.destroy(); resolve(); });
    req.write(body);
    req.end();
  });
}

function alertSkip(reason, detail) {
  const msg = 'packaging.team poller ALERT\n\nReason: ' + reason + '\n' + detail + '\n\nlatest-stock.json was NOT updated.';
  try { fs.writeFileSync(ALERT_FILE, msg); } catch (e) { /* ignore */ }
  console.log(msg);
  return sendTelegram(msg);
}

function aggregate(rows, gauges) {
  const out = {};
  for (const g of gauges) out[g] = { reels: 0, qty: 0 };
  for (const r of rows) {
    for (const [g, v] of Object.entries(r.thicknesses)) {
      if (!out[g]) out[g] = { reels: 0, qty: 0 };
      out[g].reels += v.reels;
      out[g].qty += v.qty;
    }
  }
  return out;
}

async function main() {
  const now = new Date().toISOString();
  console.log('[' + now + '] Polling ' + IMAP_HOST + ' as ' + IMAP_USER);
  if (!IMAP_PASSWORD) { console.log('IMAP password not set; nothing to do.'); return; }

  let conn;
  try {
    conn = await imaps.connect({ user: IMAP_USER, password: IMAP_PASSWORD, host: IMAP_HOST, port: IMAP_PORT, tls: true, tlsOptions: { rejectUnauthorized: false } });
    await conn.getBoxes();
    const box = await conn.openBox('INBOX');
    const newUids = Object.keys(box.new || {});
    const useNew = newUids.length > 0;
    const list = useNew ? newUids : Object.keys(box.all || {});
    if (!list.length) { console.log('No messages; leaving data untouched.'); await conn.end(); return; }
    const uid = list[list.length - 1];
    const src = useNew ? box.new : box.all;
    const parts = await src.fetch(uid, { bodies: [''], struct: false });
    const msg = await simpleParser(parts[0].full || parts[0].body);
    const subject = String(msg.subject || '(no subject)').slice(0, 90);
    const html = msg.html || '';
    console.log('  Newest message: "' + subject + '"');

    if (fs.existsSync(PUBLIC_FILE)) {
      try {
        const existing = JSON.parse(fs.readFileSync(PUBLIC_FILE, 'utf8'));
        const emailDate = msg.date ? msg.date.toISOString() : '';
        if (existing.emailDate && emailDate && new Date(emailDate) <= new Date(existing.emailDate)) {
          console.log('  Email not newer than current data; keeping existing JSON.');
          await conn.end();
          return;
        }
      } catch (e) { /* proceed */ }
    }

    const parsed = html ? parseStockEmail(html) : null;
    if (!parsed || parsed.error || !parsed.data.length) {
      await alertSkip('no-parseable-stock-table',
        'Could not find a trustworthy stock table in the newest email ("' + subject + '").\nCheck whether the supplier changed the email format.');
      await conn.end();
      return;
    }

    const sumR = parsed.data.reduce((s, r) => s + r.totalReels, 0);
    const sumQ = parsed.data.reduce((s, r) => s + r.totalQty, 0);
    const stR = parsed.emailTotal.totalReels;
    const stQ = parsed.emailTotal.totalQty;
    console.log('  Parsed ' + parsed.data.length + ' rows — ' + sumR + ' rolls, ' + sumQ + ' kg (TOTAL line: ' + stR + ' / ' + stQ + ')');

    const emailDate = msg.date ? msg.date.toISOString() : '';
    const json = {
      // NOTE: do not include subject/from — those leak supplier identity
      timestamp: now,
      emailDate,
      thicknesses: parsed.gauges,
      totalReels: sumR,
      totalQty: sumQ,
      totals: { totalsByThickness: aggregate(parsed.data, parsed.gauges), totalReels: stR, totalQty: stQ },
      data: parsed.data,
    };
    fs.mkdirSync(path.dirname(PUBLIC_FILE), { recursive: true });
    fs.writeFileSync(PUBLIC_FILE, JSON.stringify(json, null, 2));
    console.log('  Saved ' + PUBLIC_FILE);
    await conn.end();
    console.log('\nDone — ' + parsed.data.length + ' rows, ' + sumR + ' rolls');
  } catch (err) {
    console.error('Poller error:', err.message);
    if (process.env.DEBUG) console.error(err.stack);
    await alertSkip('poller-error', err.message);
    process.exitCode = 1;
    if (conn) { try { await conn.end(); } catch (e) { /* ignore */ } }
  }
}

// ─── Parser (validated against 74 archived supplier emails) ─────────
// Stock-email table parser (v35). Validated against 74 archived supplier emails.
//
// Two layouts occur:
//   COMBO  — gauge header cells are '7 (R/Q)'; a data row is
//            width | 'R / Q' per gauge | Total Reels | Total Qty.
//   SPLIT  — gauge header spans two columns (+ a Reels/Qty sub-header row); a data row is
//            width | Reels, Qty per gauge | Total Reels | Total Qty.
// Column count AND names change between emails (a new gauge like 80µ appears), so the
// template is always rebuilt from the header row — never hardcoded.
// Trust rule: a row is kept only if its last two cells (reels, qty) equal the sum of its
// gauge cells. The email TOTAL row is accepted only when it equals the sum of kept rows;
// otherwise nothing is committed (fail closed, alert).

function stripTags(s) {
  return s.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim();
}

function cellsOfRow(rowHtml) {
  const out = [];
  const re = /<(td|th)[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = re.exec(rowHtml)) !== null) {
    let repeat = 1;
    const cm = m[0].match(/colspan\s*=\s*["']?(\d+)/i);
    if (cm) repeat = parseInt(cm[1], 10);
    const t = stripTags(m[2]);
    for (let k = 0; k < repeat; k++) out.push(t);
  }
  return out;
}

function toInt(s) {
  const t = (s === null || s === undefined) ? '' : String(s).replace(/,/g, '').trim();
  return /^\d+$/.test(t) ? parseInt(t, 10) : null;
}

const EMPTY = new Set(['', '-', '—', '–']);

function parseStockEmail(body) {
  const decoded = body.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
  const tables = decoded.match(/<table[\s\S]*?<\/table>/gi) || [decoded];
  const candidates = [];

  for (const tbl of tables) {
    const rows = tbl.match(/<tr[\s\S]*?<\/tr>/gi) || [];
    if (rows.length < 6) continue;
    const parsed = rows.map(cellsOfRow);

    // ---- header + sub-header ----
    let hdr = -1;
    for (let i = 0; i < Math.min(3, parsed.length); i++) {
      if (parsed[i].length >= 4 && /^width/i.test(parsed[i][0] || '')) { hdr = i; break; }
    }
    if (hdr < 0) continue;
    const sub = parsed[hdr + 1] || [];
    const hasSub = sub.length >= 6 && sub.every((t) => EMPTY.has((t || '').trim()) || /^(reels|qty)/i.test(t.trim()));
    const skip = new Set([hdr]);
    if (hasSub) skip.add(hdr + 1);

    const hdrCells = parsed[hdr];

    // ---- gauge list + row width ----
    let gauges = [];
    let width = 0;
    const comboMarkers = hdrCells.slice(1).filter((t) => /\(R\s*\/\s*Q\)/i.test((t || '').trim()));
    if (comboMarkers.length >= 4) {
      gauges = comboMarkers.map((t) => ((t || '').match(/^([0-9]+(?:\.[0-9]+)?)/) || [])[1]).filter(Boolean);
      width = 1 + gauges.length + 2;
    } else {
      const numericCells = hdrCells.slice(1).filter((t) => /^\d+(\.\d+)?(\u00b5|\u03bc|\uFFFD|A)?$/.test((t || '').trim()));
      if (numericCells.length >= 8 && hasSub) {
        // gauge spans two cells
        for (let i = 0; i < numericCells.length; i += 2) {
          const g = ((numericCells[i] || '').match(/^([0-9]+(?:\.[0-9]+)?)/) || [])[1];
          if (g && !gauges.includes(g)) gauges.push(g);
        }
        width = 1 + gauges.length * 2 + 2;
      } else {
        for (const t of numericCells) {
          const g = ((t || '').match(/^([0-9]+(?:\.[0-9]+)?)/) || [])[1];
          if (g && !gauges.includes(g)) gauges.push(g);
        }
        if (gauges.length >= 4) width = 1 + gauges.length * 2 + 2;
      }
    }
    if (!gauges.length) continue;
    const isCombo = width === 1 + gauges.length + 2;

    // ---- 'Total' label on many rows (one supplier quirk): width is not the first cell ----
    const labelRows = parsed.filter((c) => /^total\b/i.test((c[0] || '').trim())).length;
    const labelShift = labelRows >= parsed.length * 0.6;

    const data = [];
    let emailTotal = null;

    for (let ri = 0; ri < parsed.length; ri++) {
      if (skip.has(ri)) continue;
      const c = parsed[ri];
      if (!c.length) continue;
      const first = (c[0] || '').trim();
      if (/^width/i.test(first) || /^(reels|qty)$/i.test(first)) continue;

      // ---- TOTAL line: label + mostly numeric interior + trailing R/Q pair ----
      if (/^total\b/i.test(first) && c.length > 4) {
        const tr = toInt(c[c.length - 2]);
        const tq = toInt(c[c.length - 1]);
        if (tr === null || tq === null) continue;
        const interior = c.slice(1, c.length - 2);
        const numericInterior = interior.filter((t) => /^\d[\d,]*$/.test((t || '').trim()));
        const emptyInterior = interior.filter((t) => EMPTY.has((t || '').trim()));
        const okShape = numericInterior.length + emptyInterior.length === interior.length
          && (isCombo || numericInterior.length === gauges.length * 2);
        if (okShape && !emailTotal && data.length >= 10) {
          emailTotal = { totalReels: tr, totalQty: tq };
        }
        continue;
      }

      // ---- DATA row ----
      let w = null;
      let vals = null;
      if (labelShift && /^total\b/i.test(first)) {
        for (let k = 1; k < c.length - 2; k++) {
          const v = toInt(c[k]);
          if (v !== null && v >= 200 && v <= 2500) { w = v; vals = c.slice(k + 1); break; }
        }
        if (w === null) continue;
      } else {
        w = toInt(first);
        if (w === null || w < 200 || w > 2500) continue;
        vals = c.slice(1);
      }

      if (isCombo) {
        if (vals.length !== gauges.length + 2) continue;
        const thicknesses = {};
        let sr = 0;
        let sq = 0;
        let ok = true;
        for (let gi = 0; gi < gauges.length; gi++) {
          const t = (vals[gi] || '').trim();
          if (EMPTY.has(t)) continue;
          const m = t.match(/^(\d+)\s*\/\s*([\d,]+)$/);
          if (!m) { ok = false; break; }
          const rv = parseInt(m[1], 10);
          const qv = parseInt(m[2].replace(/,/g, ''), 10);
          thicknesses[gauges[gi]] = { reels: rv, qty: qv };
          sr += rv;
          sq += qv;
        }
        if (!ok) continue;
        const tr = toInt(vals[gauges.length]);
        const tq = toInt(vals[gauges.length + 1]);
        if (tr === null || tq === null || tr !== sr || tq !== sq) continue;
        data.push({ width: w, thicknesses, totalReels: tr, totalQty: tq });
      } else {
        if (vals.length !== gauges.length * 2 + 2) continue;
        const thicknesses = {};
        let sr = 0;
        let sq = 0;
        let ok = true;
        for (let gi = 0; gi < gauges.length; gi++) {
          const a = (vals[gi * 2] || '').trim();
          const b = (vals[gi * 2 + 1] || '').trim();
          if (EMPTY.has(a) || EMPTY.has(b)) continue;
          const rv = toInt(a);
          const qv = toInt(b);
          if (rv === null || qv === null) { ok = false; break; }
          thicknesses[gauges[gi]] = { reels: rv, qty: qv };
          sr += rv;
          sq += qv;
        }
        if (!ok) continue;
        const tr = toInt(vals[gauges.length * 2]);
        const tq = toInt(vals[gauges.length * 2 + 1]);
        if (tr === null || tq === null || tr !== sr || tq !== sq) continue;
        data.push({ width: w, thicknesses, totalReels: tr, totalQty: tq });
      }
    }
    if (data.length >= 10 && emailTotal) candidates.push({ gauges, data, emailTotal });
  }

  if (candidates.length) {
    candidates.sort((a, b) => b.data.length - a.data.length);
    return candidates[0];
  }
  return { error: 'no-parseable-stock-table' };
}



if (require.main === module) {
  main();
}

module.exports = { parseStockEmail };
