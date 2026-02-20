/**
 * Parses email (.eml) files and extracts the stock table data
 * Uses eml-format library + creative pattern extraction
 */

import * as emlformat from 'eml-format';
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
    return parseEMLWithLibrary(content);
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
 * Parse .eml using eml-format library + pattern extraction
 */
async function parseEMLWithLibrary(content: string): Promise<ParsedEmailData[]> {
  console.log("Parsing EML with eml-format library...");
  
  try {
    // Use eml-format to parse the email
    const parsed = await new Promise<any>((resolve, reject) => {
      emlformat.read(content, (err: any, result: any) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
    
    console.log("EML parsed successfully");
    console.log("Subject:", parsed.subject);
    console.log("Has text:", !!parsed.text);
    console.log("Has HTML:", !!parsed.html);
    
    // Try text body first
    if (parsed.text) {
      console.log("Text body preview:", parsed.text.substring(0, 500));
      const data = parseCSVWithPapa(parsed.text);
      if (data.length > 0) return data;
      
      const textData = parseTextTable(parsed.text);
      if (textData.length > 0) return textData;
    }
    
    // Try HTML body
    if (parsed.html) {
      console.log("HTML body found, extracting text...");
      const textFromHtml = extractTextFromHTML(parsed.html);
      console.log("Extracted from HTML:", textFromHtml.substring(0, 500));
      
      const data = parseCSVWithPapa(textFromHtml);
      if (data.length > 0) return data;
      
      const textData = parseTextTable(textFromHtml);
      if (textData.length > 0) return textData;
      
      // Try HTML table extraction
      const htmlTableData = extractHTMLTable(parsed.html);
      if (htmlTableData.length > 0) return htmlTableData;
    }
    
  } catch (err) {
    console.log("eml-format failed, trying fallback...", err);
  }
  
  // Fallback: try manual extraction methods
  return parseEMLManualFallback(content);
}

/**
 * Extract text from HTML
 */
function extractTextFromHTML(html: string): string {
  return html
    .replace(/<table[^>]*>[\s\S]*?<\/table>/gi, (match) => {
      // Convert table to CSV-like format
      const rows = match.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
      return rows.map(row => {
        const cells = row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || [];
        return cells.map(cell => 
          cell.replace(/<[^>]+>/g, '').trim()
        ).join(',');
      }).join('\n');
    })
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract data from HTML table directly
 */
function extractHTMLTable(html: string): ParsedEmailData[] {
  const data: ParsedEmailData[] = [];
  
  // Find all tables
  const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) return [];
  
  const table = tableMatch[1];
  const rows = table.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
  
  console.log(`Found ${rows.length} rows in HTML table`);
  
  for (const row of rows) {
    const cells = row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) || [];
    const values = cells.map(cell => {
      const text = cell.replace(/<[^>]+>/g, '').trim();
      return parseFloat(text) || 0;
    }).filter(v => v > 0);
    
    if (values.length >= 2 && values[0] >= 100 && values[0] <= 2000) {
      const width = values[0];
      const nums = values.slice(1);
      
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
      
      if (rowData.totalReels > 0 || rowData.totalQty > 0) {
        data.push(rowData);
      }
    }
  }
  
  return data;
}

/**
 * Manual fallback for EML parsing
 */
function parseEMLManualFallback(content: string): ParsedEmailData[] {
  console.log("Using manual fallback...");
  
  // Try multiple extraction methods
  const methods = [
    extractBase64Content,
    extractQuotedPrintable,
    extractPlainText,
    extractRawContent
  ];
  
  for (const method of methods) {
    const extracted = method(content);
    if (extracted) {
      console.log(`Method ${method.name} extracted ${extracted.length} chars`);
      
      let data = parseCSVWithPapa(extracted);
      if (data.length > 0) return data;
      
      data = parseTextTable(extracted);
      if (data.length > 0) return data;
    }
  }
  
  return [];
}

function extractBase64Content(content: string): string | null {
  const match = content.match(/Content-Transfer-Encoding: base64[\s\S]*?\n\n([A-Za-z0-9+/=\s]+)/i);
  if (match) {
    try {
      return Buffer.from(match[1].replace(/\s/g, ''), 'base64').toString('utf-8');
    } catch (e) {
      return null;
    }
  }
  return null;
}

function extractQuotedPrintable(content: string): string | null {
  const match = content.match(/Content-Transfer-Encoding: quoted-printable[\s\S]*?\n\n([\s\S]*?)(?=\n--|$)/i);
  if (match) {
    return decodeQuotedPrintable(match[1]);
  }
  return null;
}

function extractPlainText(content: string): string | null {
  const match = content.match(/Content-Type: text\/plain[\s\S]*?\n\n([\s\S]*?)(?=\n--|$)/i);
  return match ? match[1] : null;
}

function extractRawContent(content: string): string {
  return content;
}

/**
 * Parse CSV using PapaParse
 */
function parseCSVWithPapa(csvContent: string): ParsedEmailData[] {
  console.log("Parsing with PapaParse...");
  
  const data: ParsedEmailData[] = [];
  let dataStarted = false;
  
  const result = Papa.parse(csvContent, {
    skipEmptyLines: true,
    delimiter: ',',
    quoteChar: '"'
  });
  
  console.log(`PapaParse found ${result.data.length} rows`);
  
  for (const row of result.data) {
    if (!Array.isArray(row) || row.length < 3) continue;
    
    const firstCol = row[0]?.toString().trim() || '';
    
    // Check if this is a header row
    if (firstCol.toLowerCase().includes('width') || 
        firstCol.toLowerCase().includes('reels')) {
      dataStarted = true;
      continue;
    }
    
    // Skip total row
    if (firstCol.toLowerCase().startsWith('total')) continue;
    
    // Skip if data hasn't started
    if (!dataStarted) continue;
    
    // Parse width
    const width = parseFloat(firstCol);
    if (isNaN(width) || width < 100 || width > 2000) continue;
    
    // Parse remaining columns as numbers
    const nums = row.slice(1).map((v: any) => {
      const n = parseInt(v);
      return isNaN(n) ? 0 : n;
    });
    
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
    
    // Check if row has actual data
    const hasData = Object.entries(rowData).some(([k, v]) => 
      k !== 'width' && typeof v === 'number' && v > 0
    );
    
    if (hasData) {
      data.push(rowData);
      console.log("Parsed row:", rowData);
    }
  }
  
  console.log(`PapaParse returned ${data.length} valid rows`);
  return data;
}

/**
 * Parse text table format
 */
function parseTextTable(text: string): ParsedEmailData[] {
  console.log("Parsing as text table...");
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
    
    const hasData = Object.entries(rowData).some(([k, v]) => 
      k !== 'width' && typeof v === 'number' && v > 0
    );
    
    if (hasData) {
      data.push(rowData);
    }
  }
  
  console.log(`Text table returned ${data.length} rows`);
  return data;
}

/**
 * Decodes quoted-printable encoding
 */
function decodeQuotedPrintable(text: string): string {
  let result = text.replace(/=\r?\n/g, '');
  result = result.replace(/=([0-9A-Fa-f]{2})/g, (_match, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });
  result = result.replace(/=3D/g, '=');
  result = result.replace(/=20/g, ' ');
  result = result.replace(/=2C/g, ',');
  return result;
}
