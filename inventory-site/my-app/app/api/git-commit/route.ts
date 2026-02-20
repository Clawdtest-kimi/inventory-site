import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

/**
 * API endpoint to auto-commit data changes to GitHub
 */
export async function POST(request: NextRequest) {
  try {
    const { data, filename, timestamp } = await request.json();
    
    // Repo directory (workspace root)
    const repoDir = "/Users/apple/.openclaw/workspace";
    const dataDir = path.join(repoDir, "inventory-site/my-app/data");
    
    // Ensure data directory exists
    fs.mkdirSync(dataDir, { recursive: true });
    
    // Save data to file
    const dataFile = path.join(dataDir, "latest-stock.json");
    fs.writeFileSync(dataFile, JSON.stringify({
      timestamp,
      source: filename || "API",
      data
    }, null, 2));
    
    // Git operations
    try {
      // Add file
      execSync("git add inventory-site/my-app/data/latest-stock.json", { cwd: repoDir });
      
      // Commit
      const commitMsg = `data: auto-update from ${filename || 'API'} - ${timestamp}`;
      execSync(`git commit -m "${commitMsg}"`, { cwd: repoDir });
      
      // Push
      execSync("git push origin main", { cwd: repoDir });
      
      return NextResponse.json({
        success: true,
        message: "Committed to GitHub",
        timestamp
      });
    } catch (gitError: any) {
      return NextResponse.json({
        success: false,
        message: "Git operation failed: " + gitError.message
      }, { status: 500 });
    }
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: "Error: " + error.message
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Git commit API ready"
  });
}
