/**
 * Parses email (.eml) files and extracts the stock table data using mailparser
 */

export interface ParsedEmailData {
  width: number;
  reels635?: number;
  qty635?: number;
  reels7?: number;
  qty7?: number;
  reels8?: number;
  qty8?: number;
  reels9?: number;
  qty9?: number;
  reels12?: number;
  qty12?: number;
  reels37?: number;
  qty37?: number;
  reels40?: number;
  qty40?: number;
  totalReels: number;
  totalQty: number;
}

/**
 * Main entry point - detects file type and parses accordingly
 */
export async function parseStockFile(content: string, filename: string): Promise<ParsedEmailData[]> {
  const lowerName = filename.toLowerCase();
  
  if (lowerName.endsWith('.eml')) {
    return parseEML(content);
  }
  
  if (lowerName.endsWith('.csv')) {
    return parseCSV(content);
  }
  
  // Try all parsers for text files
  const result = parseCSV(content);
  if (result.length > 0) return result;
  
  const textResult = parseTextTable(content);
  if (textResult.length > 0) return textResult;
  
  return [];
}

/**
 * Parse .eml email file using simple regex extraction
 */
async function parseEML(content: string): Promise<ParsedEmailData[]> {
  console.log("Parsing EML file, length:", content.length);
  
  // Try multiple extraction methods
  
  // Method 1: Look for base64 encoded content
  const base64Match = content.match(/Content-Transfer-Encoding: base64[\s\S]*?\n\n([A-Za-z0-9+/=\s]+)/);
  if (base64Match) {
    try {
      const decoded = Buffer.from(base64Match[1].replace(/\s/g, ''), 'base64').toString('utf-8');
      console.log("Base64 decoded preview:", decoded.substring(0, 300));
      const data = parseCSV(decoded);
      if (data.length > 0) return data;
    } catch (e) {
      console.log("Base64 decode failed");
    }
  }
  
  // Method 2: Look for quoted-printable content
  const qpMatch = content.match(/Content-Transfer-Encoding: quoted-printable[\s\S]*?\n\n([\s\S]*?)(?=\n--|$)/);
  if (qpMatch) {
    const decoded = decodeQuotedPrintable(qpMatch[1]);
    console.log("Quoted-printable decoded preview:", decoded.substring(0, 300));
    const data = parseCSV(decoded);
    if (data.length > 0) return data;
  }
  
  // Method 3: Look for plain text body
  const textMatch = content.match(/Content-Type: text\/plain[\s\S]*?\n\n([\s\S]*?)(?=\n--|$)/);
  if (textMatch) {
    console.log("Plain text body preview:", textMatch[1].substring(0, 300));
    const data = parseCSV(textMatch[1]);
    if (data.length > 0) return data;
  }
  
  // Method 4: Try parsing the entire content as CSV
  console.log("Trying full content as CSV");
  const data = parseCSV(content);
  if (data.length > 0) return data;
  
  // Method 5: Try text table parsing on decoded content
  const decodedBody = decodeQuotedPrintable(content);
  const textData = parseTextTable(decodedBody);
  if (textData.length > 0) return textData;
  
  console.log("All parsing methods failed");
  return [];
}

/**
 * Decodes quoted-printable encoding
 */
function decodeQuotedPrintable(text: string): string {
  // Handle soft line breaks (= at end of line)
  let result = text.replace(/=\r?\n/g, '');
  
  // Decode =XX hex sequences
  result = result.replace(/=([0-9A-Fa-f]{2})/g, (_match, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });
  
  // Handle common encoded characters
  result = result.replace(/=3D/g, '=');
  result = result.replace(/=20/g, ' ');
  result = result.replace(/=2C/g, ',');
  
  return result;
}

/**
 * Parse CSV format - more robust version
 */
function parseCSV(csvContent: string): ParsedEmailData[] {
  console.log("Parsing CSV, content preview:", csvContent.substring(0, 500));
  
  const lines = csvContent.split(/\r?\n/);
  const data: ParsedEmailData[] = [];
  let dataStarted = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip empty lines
    if (!trimmed) continue;
    
    // Look for header row patterns
    if (trimmed.toLowerCase().includes('width') || 
        trimmed.toLowerCase().includes('reels')) {
      dataStarted = true;
      continue;
    }
    
    // Skip total row
    if (trimmed.toLowerCase().startsWith('total')) continue;
    
    // Skip if data hasn't started yet
    if (!dataStarted) continue;
    
    // Parse the line
    // Handle both comma-separated and space/tab-separated
    let cols: string[];
    if (trimmed.includes(',')) {
      cols = trimmed.split(',').map(c => c.trim());
    } else {
      // Space/tab separated
      cols = trimmed.split(/\s+/).map(c => c.trim());
    }
    
    if (cols.length < 2) continue;
    
    // First column should be width (number between 100-2000)
    const width = parseFloat(cols[0]);
    if (isNaN(width) || width < 100 || width > 2000) continue;
    
    // Parse all numbers from remaining columns
    const nums: number[] = [];
    for (let i = 1; i < cols.length; i++) {
      const num = parseInt(cols[i]);
      nums.push(isNaN(num) ? 0 : num);
    }
    
    // Need at least some data
    if (nums.length < 2) continue;
    
    const row: ParsedEmailData = {
      width,
      reels635: nums[0] || 0,
      qty635: nums[1] || 0,
      reels7: nums[2] || 0,
      qty7: nums[3] || 0,
      reels8: nums[4] || 0,
      qty8: nums[5] || 0,
      reels9: nums[6] || 0,
      qty9: nums[7] || 0,
      reels12: nums[8] || 0,
      qty12: nums[9] || 0,
      reels37: nums[10] || 0,
      qty37: nums[11] || 0,
      reels40: nums[12] || 0,
      qty40: nums[13] || 0,
      totalReels: nums[14] || 0,
      totalQty: nums[15] || 0,
    };
    
    // Only add if there's actual data
    const hasData = (row.reels635 || 0) + (row.reels7 || 0) + (row.reels8 || 0) + 
                    (row.reels9 || 0) + (row.reels12 || 0) + (row.reels37 || 0) + 
                    (row.reels40 || 0) + row.totalReels > 0;
    
    if (hasData) {
      data.push(row);
      console.log("Parsed row:", row);
    }
  }
  
  console.log(`Parsed ${data.length} rows from CSV`);
  return data;
}

/**
 * Parse text table format (space-separated or pipe-delimited)
 */
function parseTextTable(text: string): ParsedEmailData[] {
  console.log("Parsing text table");
  const data: ParsedEmailData[] = [];
  const lines = text.split(/\r?\n/);
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip header/total rows
    if (!trimmed || 
        trimmed.toLowerCase().startsWith('width') || 
        trimmed.toLowerCase().startsWith('total') ||
        trimmed.toLowerCase().startsWith('reels')) continue;
    
    // Look for width at start (3-4 digits)
    const widthMatch = trimmed.match(/^(\d{3,4})\b/);
    if (!widthMatch) continue;
    
    const width = parseInt(widthMatch[1]);
    
    // Extract all numbers from the line
    const numbers = trimmed.match(/\b\d+\b/g);
    if (!numbers || numbers.length < 10) continue;
    
    const nums = numbers.slice(1).map(n => parseInt(n) || 0);
    
    const row: ParsedEmailData = {
      width,
      reels635: nums[0] || 0,
      qty635: nums[1] || 0,
      reels7: nums[2] || 0,
      qty7: nums[3] || 0,
      reels8: nums[4] || 0,
      qty8: nums[5] || 0,
      reels9: nums[6] || 0,
      qty9: nums[7] || 0,
      reels12: nums[8] || 0,
      qty12: nums[9] || 0,
      reels37: nums[10] || 0,
      qty37: nums[11] || 0,
      reels40: nums[12] || 0,
      qty40: nums[13] || 0,
      totalReels: nums[14] || 0,
      totalQty: nums[15] || 0,
    };
    
    const hasData = (row.reels635 || 0) + (row.reels7 || 0) + (row.reels8 || 0) + 
                    (row.reels9 || 0) + (row.reels12 || 0) + (row.reels37 || 0) + 
                    (row.reels40 || 0) + row.totalReels > 0;
    
    if (hasData) {
      data.push(row);
    }
  }
  
  console.log(`Parsed ${data.length} rows from text table`);
  return data;
}
