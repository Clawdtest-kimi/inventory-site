import { NextResponse } from "next/server";

// Build-time constants - update these when you deploy
const BUILD_INFO = {
  hash: "1f64540",
  date: "2026-02-20 08:45:00 +0200",
  message: "Hide columns with no data (all zeros/dashes)"
};

export async function GET() {
  return NextResponse.json(BUILD_INFO);
}