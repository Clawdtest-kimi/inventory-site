import { NextResponse } from "next/server";
import { execSync } from "child_process";

export async function GET() {
  try {
    // Get latest commit info
    const hash = execSync("git rev-parse --short HEAD", { cwd: process.cwd() }).toString().trim();
    const date = execSync("git log -1 --format=%ci", { cwd: process.cwd() }).toString().trim();
    const message = execSync("git log -1 --format=%s", { cwd: process.cwd() }).toString().trim();
    
    return NextResponse.json({
      hash,
      date,
      message
    });
  } catch (error) {
    return NextResponse.json({
      hash: "unknown",
      date: new Date().toISOString(),
      message: "Could not fetch git info"
    }, { status: 500 });
  }
}