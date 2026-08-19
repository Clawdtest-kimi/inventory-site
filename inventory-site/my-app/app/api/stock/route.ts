import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Always dynamic — never cached
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'public', 'latest-stock.json');
    const data = fs.readFileSync(filePath, 'utf-8');
    const json = JSON.parse(data);

    // STRIP internal metadata — only expose what the website needs
    // Removes: timestamp, subject (supplier name!), from (email!), emailDate
    const publicData = {
      thicknesses: json.thicknesses || [],
      totalReels: json.totalReels || 0,
      totalQty: json.totalQty || 0,
      totals: json.totals || {},
      data: json.data || [],
    };

    return NextResponse.json(publicData, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to load stock data' },
      { status: 500 }
    );
  }
}