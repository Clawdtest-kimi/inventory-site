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

    return NextResponse.json(json, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to load stock data' },
      { status: 500 }
    );
  }
}