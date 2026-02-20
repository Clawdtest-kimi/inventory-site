/**
 * Parses email (.eml) files and extracts the stock table data
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
export function parseStockFile(content: string, filename: string): ParsedEmailData[] {
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
  
  return parseEmailTable(content);
}

/**
 * Parse .eml email file - extract body and find table
 */
function parseEML(content: string): ParsedEmailData[] {
  console.log("Parsing EML file, length:", content.length);
  
  // Try to extract the plain text body from the email
  let body = extractEmailBody(content);
  console.log("Extracted body length:", body.length);
  console.log("Body preview:", body.substring(0, 500));
  
  // Try parsing as CSV first (most reliable)
  let data = parseCSV(body);
  console.log("CSV parse result:", data.length, "rows");
  if (data.length > 0) return data;
  
  // Try as text table
  data = parseTextTable(body);
  console.log("Text table parse result:", data.length, "rows");
  if (data.length > 0) return data;
  
  // Try the raw email content
  data = parseEmailTable(content);
  console.log("Raw email parse result:", data.length, "rows");
  if (data.length > 0) return data;
  
  return [];
}

/**
 * Extract the text body from an email
 */
function extractEmailBody(emlContent: string): string {
  // Decode quoted-printable first
  let decoded = decodeQuotedPrintable(emlContent);
  
  // Look for the plain text body - more flexible regex
  const plainTextMatch = decoded.match(/Content-Type:\s*text\/plain[\s\S]*?(?:\r?\n){2}([\s\S]*?)(?=(?:\r?\n--[\w-]+|$))/i);
  if (plainTextMatch) {
    return plainTextMatch[1].trim();
  }
  
  // If no plain text, look for HTML and strip tags
  const htmlMatch = decoded.match(/Content-Type:\s*text\/html[\s\S]*?(?:\r?\n){2}([\s\S]*?)(?=(?:\r?\n--[\w-]+|$))/i);
  if (htmlMatch) {
    return stripHtmlTags(htmlMatch[1]);
  }
  
  // Return the whole decoded content if no specific body found
  return decoded;
}

/**
 * Remove HTML tags
 */
function stripHtmlTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse CSV format (handles both regular CSV and email table format)
 */
function parseCSV(csvContent: string): ParsedEmailData[] {
  console.log("Parsing CSV, content preview:", csvContent.substring(0, 500));
  
  const lines = csvContent.trim().split(/\r?\n/);
  const data: ParsedEmailData[] = [];
  let dataStarted = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip empty lines
    if (!trimmed) continue;
    
    // Look for header row to identify data start
    if (trimmed.toLowerCase().includes('width') || trimmed.toLowerCase().includes('reels (nos)')) {
      dataStarted = true;
      continue;
    }
    
    // Skip total row
    if (trimmed.toLowerCase().startsWith('total')) continue;
    
    // Skip if data hasn't started yet
    if (!dataStarted) continue;
    
    // Split by comma and clean up
    const cols = trimmed.split(',').map(c => c.trim()).filter(c => c !== '');
    if (cols.length < 2) continue;
    
    // First column should be width (number)
    const width = parseFloat(cols[0]);
    if (isNaN(width) || width < 100 || width > 2000) continue;
    
    // Parse numbers from remaining columns
    const nums = cols.slice(1).map(c => parseInt(c) || 0);
    
    // Need at least some data columns
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
      totalReels: nums[14] || nums.filter((_, i) => i % 2 === 0 && i < 14).reduce((a, b) => a + b, 0),
      totalQty: nums[15] || nums.filter((_, i) => i % 2 === 1 && i < 14).reduce((a, b) => a + b, 0),
    };
    
    // Only add if there's actual data
    if (row.totalReels > 0 || row.totalQty > 0 || row.reels635 > 0 || row.reels7 > 0) {
      data.push(row);
      console.log("Parsed row:", row);
    }
  }
  
  console.log(`Parsed ${data.length} rows from CSV`);
  return data;
}

/**
 * Parse text table format (pipe-delimited or space-separated)
 */
function parseTextTable(text: string): ParsedEmailData[] {
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
    if (!numbers || numbers.length < 16) continue;
    
    // Parse the data
    const row: ParsedEmailData = {
      width,
      reels635: parseInt(numbers[1]) || 0,
      qty635: parseInt(numbers[2]) || 0,
      reels7: parseInt(numbers[3]) || 0,
      qty7: parseInt(numbers[4]) || 0,
      reels8: parseInt(numbers[5]) || 0,
      qty8: parseInt(numbers[6]) || 0,
      reels9: parseInt(numbers[7]) || 0,
      qty9: parseInt(numbers[8]) || 0,
      reels12: parseInt(numbers[9]) || 0,
      qty12: parseInt(numbers[10]) || 0,
      reels37: parseInt(numbers[11]) || 0,
      qty37: parseInt(numbers[12]) || 0,
      reels40: parseInt(numbers[13]) || 0,
      qty40: parseInt(numbers[14]) || 0,
      totalReels: parseInt(numbers[15]) || 0,
      totalQty: parseInt(numbers[16]) || 0,
    };
    
    if (row.totalReels > 0 || row.totalQty > 0) {
      data.push(row);
    }
  }
  
  return data;
}

/**
 * Legacy email table parser (fallback)
 */
function parseEmailTable(emlContent: string): ParsedEmailData[] {
  const decoded = decodeQuotedPrintable(emlContent);
  return parseTextTable(decoded);
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
  
  // Handle =3D which is encoded equals sign
  result = result.replace(/=3D/g, '=');
  
  return result;
}
