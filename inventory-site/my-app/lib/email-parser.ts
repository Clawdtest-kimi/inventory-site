/**
 * Parses email (.eml) files and extracts the stock table data
 * Client-side compatible - uses PapaParse + manual extraction
 */

import Papa from 'papaparse';

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
    return parseCSVWithPapa(content);
  }
  
  // Try all parsers for text files
  const result = parseCSVWithPapa(content);
  if (result.length > 0) return result;
  
  const textResult = parseTextTable(content);
  if (textResult.length > 0) return textResult;
  
  return [];
}

/**
 * Parse .eml file - extract body and find table
 */
function parseEML(content: string): ParsedEmailData[] {
  console.log("=== EML PARSER START ===");
  console.log("File length:", content.length);
  
  // Method 1: Extract and decode base64 content
  const base64Decoded = extractBase64(content);
  if (base64Decoded) {
    console.log("Method 1 - Base64: extracted", base64Decoded.length, "chars");
    const data = parseCSVWithPapa(base64Decoded);
    if (data.length > 0) {
      console.log("✅ Base64 parsing succeeded with", data.length, "rows");
      return data;
    }
  }
  
  // Method 2: Extract and decode quoted-printable
  const qpDecoded = extractQuotedPrintableFull(content);
  if (qpDecoded) {
    console.log("Method 2 - Quoted-Printable: extracted", qpDecoded.length, "chars");
    const data = parseCSVWithPapa(qpDecoded);
    if (data.length > 0) {
      console.log("✅ QP parsing succeeded with", data.length, "rows");
      return data;
    }
  }
  
  // Method 3: Extract plain text body
  const plainText = extractPlainText(content);
  if (plainText) {
    console.log("Method 3 - Plain text: extracted", plainText.length, "chars");
    const data = parseCSVWithPapa(plainText);
    if (data.length > 0) {
      console.log("✅ Plain text parsing succeeded with", data.length, "rows");
      return data;
    }
  }
  
  // Method 4: Extract from HTML
  const htmlText = extractFromHTML(content);
  if (htmlText) {
    console.log("Method 4 - HTML: extracted", htmlText.length, "chars");
    const data = parseCSVWithPapa(htmlText);
    if (data.length > 0) {
      console.log("✅ HTML parsing succeeded with", data.length, "rows");
      return data;
    }
  }
  
  // Method 5: Try raw content as CSV
  console.log("Method 5 - Raw content as CSV");
  const data = parseCSVWithPapa(content);
  if (data.length > 0) {
    console.log("✅ Raw parsing succeeded with", data.length, "rows");
    return data;
  }
  
  // Method 6: Text table parsing on decoded content
  console.log("Method 6 - Text table parsing");
  const decoded = decodeQuotedPrintable(content);
  const textData = parseTextTable(decoded);
  if (textData.length > 0) {
    console.log("✅ Text table parsing succeeded with", textData.length, "rows");
    return textData;
  }
  
  console.log("❌ All parsing methods failed");
  return [];
}

/**
 * Extract base64 encoded content from email
 */
function extractBase64(content: string): string | null {
  // Look for base64 transfer encoding
  const base64Sections = content.match(/Content-Transfer-Encoding:\s*base64[\s\S]*?(?:\r?\n){2}([A-Za-z0-9+/=\s]+?)(?=\r?\n--[\w-]+|\r?\n\r?\nContent-Disposition)/gi);
  
  if (!base64Sections) return null;
  
  for (const section of base64Sections) {
    const match = section.match(/(?:\r?\n){2}([A-Za-z0-9+/=\s]+)/);
    if (match) {
      try {
        const cleaned = match[1].replace(/\s/g, '');
        const decoded = atob(cleaned);
        if (decoded.includes('Width') || decoded.includes('width') || /\d{3,4}/.test(decoded)) {
          return decoded;
        }
      } catch (e) {
        // Ignore decode errors
      }
    }
  }
  
  return null;
}

/**
 * Extract quoted-printable content
 */
function extractQuotedPrintableFull(content: string): string | null {
  const qpMatch = content.match(/Content-Transfer-Encoding:\s*quoted-printable[\s\S]*?(?:\r?\n){2}([\s\S]*?)(?=\r?\n--[\w-]+|\r?\n\r?\nContent-Disposition|$)/i);
  if (qpMatch) {
    return decodeQuotedPrintable(qpMatch[1]);
  }
  return null;
}

/**
 * Extract plain text body
 */
function extractPlainText(content: string): string | null {
  // Match text/plain sections
  const textMatch = content.match(/Content-Type:\s*text\/plain[\s\S]*?(?:\r?\n){2}([\s\S]*?)(?=\r?\n--[\w-]+|\r?\n\r?\nContent-Disposition|$)/i);
  if (textMatch) {
    const decoded = decodeQuotedPrintable(textMatch[1]);
    return decoded;
  }
  return null;
}

/**
 * Extract content from HTML parts
 */
function extractFromHTML(content: string): string | null {
  const htmlMatch = content.match(/Content-Type:\s*text\/html[\s\S]*?(?:\r?\n){2}([\s\S]*?)(?=\r?\n--[\w-]+|\r?\n\r?\nContent-Disposition|$)/i);
  if (!htmlMatch) return null;
  
  const html = decodeQuotedPrintable(htmlMatch[1]);
  
  // Extract table data from HTML
  const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
  if (tableMatch) {
    const rows = tableMatch[1].match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
    const csvRows = rows.map(row => {
      const cells = row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || [];
      return cells.map(cell => cell.replace(/<[^>]+>/g, '').trim()).join(',');
    });
    return csvRows.join('\n');
  }
  
  // Fallback: just strip tags
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Decode quoted-printable
 */
function decodeQuotedPrintable(text: string): string {
  if (!text) return '';
  
  // Handle soft line breaks
  let result = text.replace(/=\r?\n/g, '');
  
  // Decode =XX hex sequences
  result = result.replace(/=([0-9A-Fa-f]{2})/g, (_match, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });
  
  // Handle common encoded characters
  result = result.replace(/=3D/g, '=');
  result = result.replace(/=20/g, ' ');
  result = result.replace(/=2C/g, ',');
  result = result.replace(/=0D/g, '\r');
  result = result.replace(/=0A/g, '\n');
  result = result.replace(/=09/g, '\t');
  
  return result;
}

/**
 * Parse CSV using PapaParse
 */
function parseCSVWithPapa(csvContent: string): ParsedEmailData[] {
  console.log("PapaParse: input length", csvContent.length);
  
  const data: ParsedEmailData[] = [];
  let dataStarted = false;
  
  const result = Papa.parse(csvContent, {
    skipEmptyLines: true,
    delimiter: ',',
    quoteChar: '"',
    delimitersToGuess: [',', '\t', ';', '|']
  });
  
  console.log("PapaParse found", result.data.length, "rows");
  
  for (const row of result.data) {
    if (!Array.isArray(row)) continue;
    
    const firstCol = row[0]?.toString().trim() || '';
    
    // Detect header row
    if (firstCol.toLowerCase().includes('width') || 
        firstCol.toLowerCase().includes('reel') ||
        firstCol.toLowerCase().includes('mm')) {
      dataStarted = true;
      continue;
    }
    
    // Skip total row
    if (firstCol.toLowerCase().startsWith('total')) continue;
    
    // Skip if before data
    if (!dataStarted) continue;
    
    // Parse width (should be 100-2000)
    const width = parseFloat(firstCol);
    if (isNaN(width) || width < 100 || width > 2000) continue;
    
    // Parse numbers from remaining columns
    const nums: number[] = [];
    for (let i = 1; i < row.length; i++) {
      const val = row[i]?.toString().trim();
      if (!val) {
        nums.push(0);
        continue;
      }
      const num = parseInt(val.replace(/,/g, ''));
      nums.push(isNaN(num) ? 0 : num);
    }
    
    const rowData: ParsedEmailData = {
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
    
    // Check if row has any actual data
    const hasData = Object.values(rowData).some((v, i) => 
      i > 0 && typeof v === 'number' && v > 0
    );
    
    if (hasData) {
      data.push(rowData);
      console.log("Parsed row:", rowData.width, "mm,", rowData.totalReels, "reels");
    }
  }
  
  console.log("PapaParse returning", data.length, "valid rows");
  return data;
}

/**
 * Parse text table format (fallback)
 */
function parseTextTable(text: string): ParsedEmailData[] {
  console.log("Text table parser: input length", text.length);
  
  const data: ParsedEmailData[] = [];
  const lines = text.split(/\r?\n/);
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Skip headers
    if (/^width|reel|mm|total/i.test(trimmed)) continue;
    
    // Look for lines starting with width (3-4 digits)
    const match = trimmed.match(/^(\d{3,4})\s+([\d\s,\.]+)/);
    if (!match) continue;
    
    const width = parseInt(match[1]);
    const rest = match[2];
    
    // Extract all numbers
    const nums = rest.match(/\d+/g)?.map(n => parseInt(n)) || [];
    if (nums.length < 2) continue;
    
    const rowData: ParsedEmailData = {
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
      totalReels: nums[14] || nums.slice(0, 14).filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0),
      totalQty: nums[15] || nums.slice(0, 14).filter((_, i) => i % 2 === 1).reduce((a, b) => a + b, 0),
    };
    
    if (rowData.totalReels > 0 || rowData.totalQty > 0) {
      data.push(rowData);
    }
  }
  
  console.log("Text table returning", data.length, "rows");
  return data;
}
