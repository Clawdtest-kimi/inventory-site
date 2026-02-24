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
    
    let messages = await connection.search(searchCriteria, fetchOptions);
    console.log(`📨 Found ${messages.length} emails`);
    
    // Sort by date descending (newest first)
    messages = messages.sort((a, b) => {
      const dateA = new Date(a.parts.find(p => p.which === 'HEADER.FIELDS (FROM TO SUBJECT DATE)')?.body.date?.[0] || 0);
      const dateB = new Date(b.parts.find(p => p.which === 'HEADER.FIELDS (FROM TO SUBJECT DATE)')?.body.date?.[0] || 0);
      return dateB - dateA; // Newest first
    });
    
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
            const backupFile = path.join(__dirname, 'data', 'latest-stock.json');
            fs.mkdirSync(path.dirname(backupFile), { recursive: true });
            fs.writeFileSync(backupFile, JSON.stringify({
              timestamp: new Date().toISOString(),
              subject,
              from,
              data: stockData
            }, null, 2));
            
            // Auto-commit to GitHub
            try {
              const { execSync } = require('child_process');
              const repoDir = '/Users/apple/.openclaw/workspace';
              
              // Check if data directory exists in repo
              const dataDir = path.join(repoDir, 'inventory-site/my-app/data');
              fs.mkdirSync(dataDir, { recursive: true });
              
              // Copy latest data to repo
              fs.copyFileSync(backupFile, path.join(dataDir, 'latest-stock.json'));
              
              // Git commit and push
              execSync('git add inventory-site/my-app/data/latest-stock.json', { cwd: repoDir });
              const timestamp = new Date().toISOString();
              execSync(`git commit -m "data: auto-update from email - ${timestamp}"`, { cwd: repoDir });
              execSync('git push origin main', { cwd: repoDir });
              console.log('   ✅ Committed to GitHub');
            } catch (gitError) {
              console.log('   ⚠️ GitHub commit failed:', gitError.message);
            }
            
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
 * Handles HTML emails by extracting table rows
 * Skips only the row where width column contains "Total"
 */
function parseStockTable(text) {
  const rows = [];
  
  // Find table body content
  const tbodyMatch = text.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) {
    console.log('   ⚠️ No table body found');
    return rows;
  }
  
  const tbodyContent = tbodyMatch[1];
  
  // Split into table rows
  const rowMatches = tbodyContent.match(/<tr[\s\S]*?<\/tr>/gi);
  if (!rowMatches) {
    console.log('   ⚠️ No table rows found');
    return rows;
  }
  
  console.log(`   📊 Found ${rowMatches.length} table rows`);
  
  for (const rowHtml of rowMatches) {
    // Decode quoted-printable in this row
    let decoded = rowHtml
      .replace(/=\r?\n/g, '')
      .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    
    // Remove HTML tags
    const textContent = decoded.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Check if this is the Total row (contains "Total" text)
    if (textContent.toLowerCase().includes('total')) {
      console.log('   🚫 Skipping Total row');
      continue;
    }
    
    // Extract all numbers
    const numbers = textContent.match(/\b\d+\b/g);
    if (!numbers || numbers.length < 3) continue;
    
    // First number should be width
    const width = parseInt(numbers[0]);
    
    // Check if it's a known width
    if (!KNOWN_WIDTHS.includes(width)) continue;
    
    // Build row from remaining numbers
    const row = buildRowFromNumbers(width, numbers.slice(1));
    if (row) {
      rows.push(row);
      console.log(`   ✓ Width ${width}: ${row.totalReels} reels`);
    }
  }
  
  return rows;
}

/**
 * Build a row object from width and array of numbers
 * Numbers come in pairs: (reels, qty) for each thickness column
 */
function buildRowFromNumbers(width, numbers) {
  const row = { width, totalReels: 0, totalQty: 0 };
  
  // Expected thickness order in the table
  const thicknessOrder = ['635', '7', '8', '9', '12', '37', '40'];
  
  // Get expected structure for this width
  const expected = EXPECTED_DATA[width];
  
  if (!expected) {
    // Fallback: assign sequentially
    for (let i = 0; i < numbers.length - 1; i += 2) {
      const reels = parseInt(numbers[i]) || 0;
      const qty = parseInt(numbers[i + 1]) || 0;
      if (reels > 0) {
        const thickness = thicknessOrder[Math.floor(i / 2)];
        if (thickness) {
          row[`reels${thickness}`] = reels;
          row[`qty${thickness}`] = qty;
        }
      }
    }
  } else {
    // Map to expected columns
    let numIdx = 0;
    for (const thickness of thicknessOrder) {
      if (expected[`has${thickness}`] && numIdx < numbers.length - 1) {
        const reels = parseInt(numbers[numIdx]) || 0;
        const qty = parseInt(numbers[numIdx + 1]) || 0;
        numIdx += 2;
        
        if (reels > 0) {
          row[`reels${thickness}`] = reels;
          row[`qty${thickness}`] = qty;
        }
      }
    }
  }
  
  // Calculate totals from the last two numbers if present
  if (numbers.length >= 2) {
    row.totalReels = parseInt(numbers[numbers.length - 2]) || 0;
    row.totalQty = parseInt(numbers[numbers.length - 1]) || 0;
  }
  
  return row;
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

pollEmail();
