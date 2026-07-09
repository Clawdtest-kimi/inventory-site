import { NextResponse } from 'next/server';

const GIST_TOKEN = process.env["GIST_TOKEN"] || '';
const GIST_ID = process.env.GIST_ID || '';

export async function GET() {
  if (!GIST_TOKEN || !GIST_ID) {
    return NextResponse.json(
      { error: 'GIST_TOKEN or GIST_ID not configured' },
      { status: 500 }
    );
  }

  try {
    const resp = await fetch(
      `https://api.github.com/gists/${GIST_ID}`,
      {
        headers: {
          Authorization: `Bearer ${GIST_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );
    const gist = await resp.json();
    const file = gist.files?.['visitor-log.json'];
    if (!file) {
      return NextResponse.json({ visitors: [], total: 0 });
    }

    const content = JSON.parse(file.content || '{"visitors":[],"total":0}');
    return NextResponse.json(content);
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to fetch visitor logs' },
      { status: 500 }
    );
  }
}