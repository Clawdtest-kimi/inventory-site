#!/usr/bin/env node

// Namecheap Email Poller
// Polls stock@packaging.team and updates inventory site

const imaps = require('imap-simple');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// Config - Namecheap Private Email
const IMAP_CONFIG = {
  user: 'stock@packaging.team',
  password: 'Bucharest@2027',
  host: 'mail.privateemail.com',
  port: 993,
  tls: true,
  connTimeout: 30000,
  authTimeout: 30000
};

const VERCEL_API = 'https://inventory-site-v2.vercel.app/api/email';

// Known widths from the standard table
const KNOWN_WIDTHS = [565, 700, 735, 770, 780, 830, 860, 865, 870, 900, 920, 960, 970, 980, 990, 1010, 1020, 1050, 1067, 1070, 1080, 1090, 1116, 1120, 1140, 1160, 1180, 1200, 1220, 1445];

async function pollEmail() {
  console.log('📧 Connecting to mail.privateemail.com...');
  
  try {
    const connection = await imaps.connect({
      imap: IMAP_CONFIG,
      onerror: (err) => console.error('IMAP Error:', err.message)
    });
    await connection.openBox('INBOX');
    
    // Search for ALL emails from last 7 days
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    const dateStr = lastWeek.toLocaleDateString('en-US', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    }).replace(/,/g, '');
    
    const searchCriteria = [['SINCE', dateStr]];
    
    const fetchOptions = {
      bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)', 'TEXT'],
      markSeen: false
    };
    
    const messages = await connection.search(searchCriteria, fetchOptions);
    console.log(`📨 Found ${messages.length} emails`);
    
    let processedCount = 0;
    
    for (const message of messages) {
      const header = message.parts.find(p => p.which === 'HEADER.FIELDS (FROM TO SUBJECT DATE)');
      const textPart = message.parts.find(p => p.which === 'TEXT');
      
      if (!header || !textPart) continue;
      
      const subject = header.body.subject?.[0] || '';
      const from = header.body.from?.[0] || '';
      
      // Only process stock report emails
      if (!subject.toLowerCase().includes('stock') && !subject.toLowerCase().includes('report')) {
        continue;
      }
      
      console.log(`\n📧 Processing: ${subject.substring(0, 60)}...`);
      
      // Extract stock table
      const stockData = parseStockTable(textPart.body);
      
      if (stockData.length > 0) {
        console.log(`   ✅ Found ${stockData.length} rows`);
        const totalReels = stockData.reduce((sum, r) => sum + (r.totalReels || 0), 0);
        console.log(`   📊 Total reels: ${totalReels}`);
        
        // Only post if we have reasonable data (more than 10 rows)
        if (stockData.length >= 10) {
          const response = await fetch(VERCEL_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subject, from, data: stockData })
          });
          
          if (response.ok) {
            console.log('   ✅ Posted to inventory site');
            processedCount++;
            
            // Save locally for backup
            const backupFile = path.join(__dirname, 'last-stock.json');
            fs.writeFileSync(backupFile, JSON.stringify({
              timestamp: new Date().toISOString(),
              subject,
              from,
              data: stockData
            }, null, 2));
            
            // Only process the first valid email
            break;
          } else {
            console.log('   ❌ Failed to post:', await response.text());
          }
        } else {
          console.log(`   ⚠️ Data looks incomplete (${stockData.length} rows)`);
        }
      } else {
        console.log('   ⚠️ No stock table found');
      }
    }
    
    await connection.end();
    console.log(`\n✅ Done - processed ${processedCount} emails`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

/**
 * Parse stock table from email text
 * Extracts lines with just numbers and groups them by width
 */
function parseStockTable(text) {
  const rows = [];
  
  // Split into lines and find those containing just a number
  const lines = text.split(/\r?\n/);
  const numLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Match lines with just a number (and optional whitespace)
    const match = line.match(/^\s*(\d+)\s*$/);
    if (match) {
      numLines.push({ line: i, num: parseInt(match[1]) });
    }
  }
  
  let currentWidth = null;
  let values = [];
  
  for (const { num } of numLines) {
    // Check if this is a known width
    if (KNOWN_WIDTHS.includes(num)) {
      // Save previous row
      if (currentWidth && values.length >= 2) {
        const row = buildRow(currentWidth, values);
        if (row) rows.push(row);
      }
      
      // Start new row
      currentWidth = num;
      values = [];
    } else if (currentWidth !== null) {
      // Collect values for current row
      values.push(num);
    }
  }
  
  // Don't forget last row
  if (currentWidth && values.length >= 2) {
    const row = buildRow(currentWidth, values);
    if (row) rows.push(row);
  }
  
  return rows;
}

// Expected data structure for mapping email values to correct columns
const EXPECTED_DATA = {
  565: { has7: true },
  700: { has8: true, has37: true },
  735: { has8: true },
  770: { has635: true },
  780: { has8: true },
  830: { has9: true },
  860: { has7: true, has8: true },
  865: { has635: true, has7: true },
  870: { has7: true, has8: true },
  900: { has7: true },
  920: { has7: true, has8: true, has9: true },
  960: { has9: true },
  970: { has8: true },
  980: { has7: true, has8: true, has9: true },
  990: { has8: true },
  1010: { has7: true, has8: true, has12: true, has37: true, has40: true },
  1020: { has8: true },
  1050: { has7: true },
  1067: { has635: true },
  1070: { has8: true },
  1080: { has9: true },
  1090: { has7: true },
  1116: { has635: true },
  1120: { has7: true, has8: true },
  1140: { has8: true },
  1160: { has9: true },
  1180: { has8: true },
  1200: { has635: true },
  1220: { has8: true },
  1445: { has635: true }
};

function buildRow(width, values) {
  const row = { width };
  
  // Last two values are totals
  const lastTwo = values.slice(-2);
  row.totalReels = lastTwo[0] || 0;
  row.totalQty = lastTwo[1] || 0;
  
  // Get expected structure for this width
  const expected = EXPECTED_DATA[width];
  if (!expected) {
    // Fallback: just assign to first available columns
    const thicknessKeys = ['635', '7', '8', '9', '12', '37', '40'];
    const dataValues = values.slice(0, -2);
    for (let i = 0; i < dataValues.length - 1; i += 2) {
      const reels = dataValues[i];
      const qty = dataValues[i + 1];
      if (reels > 0) {
        const pairIndex = Math.floor(i / 2);
        if (pairIndex < thicknessKeys.length) {
          row[`reels${thicknessKeys[pairIndex]}`] = reels;
          row[`qty${thicknessKeys[pairIndex]}`] = qty;
        }
      }
    }
    return row;
  }
  
  // Map values to expected columns
  const dataValues = values.slice(0, -2);
  let valIdx = 0;
  
  const thicknessOrder = ['635', '7', '8', '9', '12', '37', '40'];
  
  for (const thickness of thicknessOrder) {
    if (expected[`has${thickness}`] && valIdx < dataValues.length - 1) {
      row[`reels${thickness}`] = dataValues[valIdx++] || 0;
      row[`qty${thickness}`] = dataValues[valIdx++] || 0;
    }
  }
  
  return row;
}

pollEmail();
