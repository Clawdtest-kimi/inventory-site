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

const VERCEL_API = 'https://www.packaging.team/api/email';

// Known widths from the standard table
const KNOWN_WIDTHS = [565, 700, 735, 770, 780, 830, 850, 860, 865, 870, 900, 920, 960, 970, 980, 990, 1010, 1020, 1050, 1067, 1070, 1080, 1090, 1116, 1120, 1140, 1160, 1180, 1200, 1220, 1445];

// Expected data structure - which widths have which thickness columns
const EXPECTED_DATA = {
  565: { has7: true },
  700: { has8: true, has37: true },
  735: { has8: true },
  770: { has635: true },
  780: { has8: true },
  830: { has9: true },
  850: { has8: true },
  860: { has7: true, has8: true },
  865: { has635: true, has7: true },
  870: { has7: true, has8: true },
  900: { has7: true },
  920: { has9: true },  // Only 9µ
  960: { has9: true },
  970: { has8: true },
  980: { has9: true },  // Only 9µ
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

async function pollEmail() {
  console.log('📧 Connecting to mail.privateemail.com...');
  
  try {
    const connection = await imaps.connect({
      imap: IMAP_CONFIG,
      onerror: (err) => console.error('IMAP Error:', err.message)
    });
    await connection.openBox('INBOX');
    
    // Search for ALL emails from last 30 days
    const lastMonth = new Date();
    lastMonth.setDate(lastMonth.getDate() - 30);
    const dateStr = lastMonth.toLocaleDateString('en-US', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    }).replace(/,/g, '');
    
    const searchCriteria = [['SINCE', dateStr], ['UNSEEN']];
    
    const fetchOptions = {
      bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)', 'TEXT'],
      markSeen: true
    };
    
    let messages = await connection.search(searchCriteria, fetchOptions);
    console.log(`📨 Found ${messages.length} emails`);
    
    // Sort by date descending (newest first)
    messages = messages.sort((a, b) => {
      const dateA = new Date(a.parts.find(p => p.which === 'HEADER.FIELDS (FROM TO SUBJECT DATE)')?.body.date?.[0] || 0);
      const dateB = new Date(b.parts.find(p => p.which === 'HEADER.FIELDS (FROM TO SUBJECT DATE)')?.body.date?.[0] || 0);
      return dateB - dateA;
    });
    
    let processedCount = 0;
    
    for (const message of messages) {
      const header = message.parts.find(p => p.which === 'HEADER.FIELDS (FROM TO SUBJECT DATE)');
      const textPart = message.parts.find(p => p.which === 'TEXT');
      
      if (!header || !textPart) continue;
      
      const subject = header.body.subject?.[0] || '';
      const from = header.body.from?.[0] || '';
      const date = header.body.date?.[0] || '';
      
      console.log(`\n📧 Checking: ${subject.substring(0, 60)}...`);
      console.log(`   📅 Date: ${date}`);
      
      // Try to parse stock data from email
      let stockData = [];
      let rawBody = textPart.body;
      
      // Check if body is base64 encoded
      if (isBase64(rawBody.trim())) {
        console.log('   🔍 Detected base64 encoding, decoding...');
        try {
          rawBody = Buffer.from(rawBody.trim().replace(/\s/g, ''), 'base64').toString('utf-8');
          console.log('   ✅ Decoded base64 successfully');
        } catch (e) {
          console.log('   ⚠️ Failed to decode base64:', e.message);
        }
      }
      
      // Try HTML table parsing first
      stockData = parseStockTable(rawBody);
      
      // If no HTML table, try plain text table
      if (stockData.length === 0) {
        stockData = parsePlainTextTable(rawBody);
      }
      
      if (stockData.length > 0) {
        // Validate and fix data
        stockData = validateAndFixData(stockData);
        
        const totalReels = stockData.reduce((sum, r) => sum + (r.totalReels || 0), 0);
        console.log(`   ✅ Found ${stockData.length} rows`);
        console.log(`   📊 Total reels: ${totalReels}`);
        
        // Show sample of parsed data
        console.log('   📋 Sample rows:');
        stockData.slice(0, 3).forEach(r => {
          const thicknesses = Object.keys(r).filter(k => k.startsWith('reels')).map(k => k.replace('reels', '')).join(',');
          console.log(`      Width ${r.width}: ${r.totalReels} reels (${thicknesses})`);
        });
        
        // Only post if we have reasonable data (more than 5 rows)
        if (stockData.length >= 5) {
          console.log('   🚀 Posting to API...');
          
          try {
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
                const dataDir = path.join(repoDir, 'inventory-site/my-app/data');
                fs.mkdirSync(dataDir, { recursive: true });
                fs.copyFileSync(backupFile, path.join(dataDir, 'latest-stock.json'));
                
                execSync('git add inventory-site/my-app/data/latest-stock.json', { cwd: repoDir });
                const timestamp = new Date().toISOString();
                execSync(`git commit -m "data: auto-update from email - ${timestamp}"`, { cwd: repoDir });
                execSync('git push origin main', { cwd: repoDir });
                console.log('   ✅ Committed to GitHub');
              } catch (gitError) {
                console.log('   ⚠️ GitHub commit failed:', gitError.message);
              }
              
              // Only process the first valid email (most recent)
              break;
            } else {
              const errorText = await response.text();
              console.log('   ❌ Failed to post:', errorText);
            }
          } catch (fetchError) {
            console.log('   ❌ API error:', fetchError.message);
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

function isBase64(str) {
  // Remove whitespace for checking
  const cleanStr = str.replace(/\s/g, '');
  if (cleanStr.length % 4 !== 0) return false;
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleanStr)) return false;
  // Try to decode a sample
  try {
    const sample = cleanStr.substring(0, 200);
    const decoded = Buffer.from(sample, 'base64').toString('utf-8');
    // Check if decoded content looks like HTML
    return decoded.includes('<') || decoded.includes('html') || decoded.includes('table') || decoded.includes('div');
  } catch {
    return false;
  }
}

function validateAndFixData(rows) {
  return rows.map(row => {
    // Calculate actual total from individual columns
    let calculatedTotal = 0;
    const thicknesses = ['635', '7', '8', '9', '12', '37', '40'];
    
    for (const t of thicknesses) {
      calculatedTotal += row[`reels${t}`] || 0;
    }
    
    // If calculated total is different, use calculated (more accurate)
    if (calculatedTotal > 0 && calculatedTotal !== row.totalReels) {
      console.log(`   ⚠️ Width ${row.width}: Correcting total ${row.totalReels} → ${calculatedTotal}`);
      row.totalReels = calculatedTotal;
    }
    
    return row;
  });
}

function parsePlainTextTable(text) {
  const rows = [];
  const lines = text.split('\n');
  
  for (const line of lines) {
    if (!line.includes('|')) continue;
    
    const parts = line.split('|').map(p => p.trim()).filter(p => p);
    if (parts.length < 3) continue;
    
    const widthMatch = parts[0].match(/(\d+)/);
    if (!widthMatch) continue;
    
    const width = parseInt(widthMatch[1]);
    if (!KNOWN_WIDTHS.includes(width)) continue;
    
    const row = { width, totalReels: 0, totalQty: 0 };
    const thicknessOrder = ['635', '7', '8', '9', '12', '37', '40'];
    
    let colIdx = 1;
    for (const thickness of thicknessOrder) {
      if (colIdx + 1 < parts.length) {
        const reelsPart = parts[colIdx];
        const qtyPart = parts[colIdx + 1];
        
        const reelsMatch = reelsPart.match(/(\d+)/);
        const qtyMatch = qtyPart.match(/(\d+)/);
        
        if (reelsMatch && qtyMatch) {
          const reels = parseInt(reelsMatch[1]);
          const qty = parseInt(qtyMatch[1]);
          
          if (reels > 0) {
            row[`reels${thickness}`] = reels;
            row[`qty${thickness}`] = qty;
          }
        }
        colIdx += 2;
      }
    }
    
    // Get totals from last two columns
    const lastParts = parts.slice(-2);
    if (lastParts.length >= 2) {
      const totalReelsMatch = lastParts[0].match(/(\d+)/);
      const totalQtyMatch = lastParts[1].match(/(\d+)/);
      if (totalReelsMatch) row.totalReels = parseInt(totalReelsMatch[1]);
      if (totalQtyMatch) row.totalQty = parseInt(totalQtyMatch[1]);
    }
    
    if (row.totalReels > 0 || Object.keys(row).length > 3) {
      rows.push(row);
    }
  }
  
  return rows;
}

function parseStockTable(text) {
  const rows = [];
  
  // Find table body content
  const tbodyMatch = text.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) {
    return rows;
  }
  
  const tbodyContent = tbodyMatch[1];
  
  // Split into table rows
  const rowMatches = tbodyContent.match(/<tr[\s\S]*?<\/tr>/gi);
  if (!rowMatches) {
    return rows;
  }
  
  console.log(`   📊 Found ${rowMatches.length} HTML table rows`);
  
  for (const rowHtml of rowMatches) {
    // Decode quoted-printable
    let decoded = rowHtml
      .replace(/=\r?\n/g, '')
      .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    
    // Remove HTML tags
    const textContent = decoded.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Skip header/total rows
    if (textContent.toLowerCase().includes('total') && !textContent.match(/^\d/)) {
      continue;
    }
    
    // Extract all numbers
    const numbers = textContent.match(/\b\d+\b/g);
    if (!numbers || numbers.length < 3) continue;
    
    // First number should be width
    const width = parseInt(numbers[0]);
    if (!KNOWN_WIDTHS.includes(width)) continue;
    
    // Build row from remaining numbers
    const row = buildRowFromNumbers(width, numbers.slice(1));
    if (row) {
      rows.push(row);
    }
  }
  
  return rows;
}

function buildRowFromNumbers(width, numbers) {
  const row = { width, totalReels: 0, totalQty: 0 };
  const thicknessOrder = ['635', '7', '8', '9', '12', '37', '40'];
  
  // Get expected structure for this width
  const expected = EXPECTED_DATA[width];
  
  if (!expected) {
    // Fallback: assign sequentially
    for (let i = 0; i < numbers.length - 2; i += 2) {
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
    // Map to expected columns - only for thicknesses this width should have
    let numIdx = 0;
    for (const thickness of thicknessOrder) {
      if (expected[`has${thickness}`] && numIdx < numbers.length - 2) {
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
  
  // Get totals from last two numbers
  if (numbers.length >= 2) {
    row.totalReels = parseInt(numbers[numbers.length - 2]) || 0;
    row.totalQty = parseInt(numbers[numbers.length - 1]) || 0;
  }
  
  // Validate: sum of individual reels should match total
  let sumReels = 0;
  for (const t of thicknessOrder) {
    sumReels += row[`reels${t}`] || 0;
  }
  
  // Use calculated sum if different from stated total
  if (sumReels > 0 && sumReels !== row.totalReels) {
    row.totalReels = sumReels;
  }
  
  return row;
}

pollEmail();
