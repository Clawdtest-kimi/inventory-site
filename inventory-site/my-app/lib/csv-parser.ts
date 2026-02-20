import { StockRow, ParsedCSV } from './types';

export function parseStockCSV(csvContent: string): ParsedCSV {
  const lines = csvContent.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/^\uFEFF/, ''));
  
  const data: StockRow[] = [];
  
  for (let i = 2; i < lines.length - 1; i++) { // Skip header rows and total row
    const line = lines[i].trim();
    if (!line) continue;
    
    const cols = line.split(',');
    if (cols.length < 3) continue;
    
    const width = parseFloat(cols[0]) || 0;
    if (!width) continue;
    
    const row: StockRow = {
      width,
      reels635: parseInt(cols[1]) || 0,
      qty635: parseInt(cols[2]) || 0,
      reels7: parseInt(cols[3]) || 0,
      qty7: parseInt(cols[4]) || 0,
      reels8: parseInt(cols[5]) || 0,
      qty8: parseInt(cols[6]) || 0,
      reels9: parseInt(cols[7]) || 0,
      qty9: parseInt(cols[8]) || 0,
      reels12: parseInt(cols[9]) || 0,
      qty12: parseInt(cols[10]) || 0,
      reels37: parseInt(cols[11]) || 0,
      qty37: parseInt(cols[12]) || 0,
      reels40: parseInt(cols[13]) || 0,
      qty40: parseInt(cols[14]) || 0,
      totalReels: parseInt(cols[15]) || 0,
      totalQty: parseInt(cols[16]) || 0,
    };
    
    data.push(row);
  }
  
  return { data, headers };
}

export function getTotalRow(data: StockRow[]): StockRow {
  return data.reduce((acc, row) => ({
    width: 0,
    reels635: (acc.reels635 || 0) + (row.reels635 || 0),
    qty635: (acc.qty635 || 0) + (row.qty635 || 0),
    reels7: (acc.reels7 || 0) + (row.reels7 || 0),
    qty7: (acc.qty7 || 0) + (row.qty7 || 0),
    reels8: (acc.reels8 || 0) + (row.reels8 || 0),
    qty8: (acc.qty8 || 0) + (row.qty8 || 0),
    reels9: (acc.reels9 || 0) + (row.reels9 || 0),
    qty9: (acc.qty9 || 0) + (row.qty9 || 0),
    reels12: (acc.reels12 || 0) + (row.reels12 || 0),
    qty12: (acc.qty12 || 0) + (row.qty12 || 0),
    reels37: (acc.reels37 || 0) + (row.reels37 || 0),
    qty37: (acc.qty37 || 0) + (row.qty37 || 0),
    reels40: (acc.reels40 || 0) + (row.reels40 || 0),
    qty40: (acc.qty40 || 0) + (row.qty40 || 0),
    totalReels: (acc.totalReels || 0) + (row.totalReels || 0),
    totalQty: (acc.totalQty || 0) + (row.totalQty || 0),
  }), {
    width: 0, totalReels: 0, totalQty: 0,
    reels635: 0, qty635: 0, reels7: 0, qty7: 0,
    reels8: 0, qty8: 0, reels9: 0, qty9: 0,
    reels12: 0, qty12: 0, reels37: 0, qty37: 0,
    reels40: 0, qty40: 0
  } as StockRow);
}
