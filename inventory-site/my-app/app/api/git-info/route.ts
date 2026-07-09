import { NextResponse } from "next/server";
import { execSync } from "child_process";

function getGitInfo() {
  try {
    const hash = execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();
    const date = execSync("git log -1 --format=%ci", { encoding: "utf-8" }).trim();
    const message = execSync("git log -1 --format=%s", { encoding: "utf-8" }).trim();
    return { hash, date, message };
  } catch {
    // Fallback if git is not available or fails
    return {
      hash: "unknown",
      date: new Date().toISOString(),
      message: "Git info unavailable"
    };
  }
}

export async function GET() {
  const gitInfo = getGitInfo();
  return NextResponse.json(gitInfo);
}