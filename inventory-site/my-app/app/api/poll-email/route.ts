import { NextRequest, NextResponse } from "next/server";
import { pollStockEmails, testIMAPConnection } from "@/lib/imap-poller";

/**
 * API endpoint to poll IMAP inbox for stock emails
 * Can be triggered manually or by cron job
 */
export async function POST(request: NextRequest) {
  try {
    // Get IMAP config from environment variables
    // User should set these in Vercel dashboard
    const config = {
      user: process.env.IMAP_USER || "",
      password: process.env.IMAP_PASSWORD || "",
      host: process.env.IMAP_HOST || "",
      port: parseInt(process.env.IMAP_PORT || "993"),
      tls: process.env.IMAP_TLS !== "false"
    };
    
    // Validate config
    if (!config.user || !config.password || !config.host) {
      return NextResponse.json({
        success: false,
        message: "IMAP not configured. Set IMAP_USER, IMAP_PASSWORD, IMAP_HOST environment variables."
      }, { status: 400 });
    }
    
    console.log("🔍 Polling IMAP inbox...");
    console.log(`📧 Server: ${config.host}:${config.port}`);
    console.log(`👤 User: ${config.user}`);
    
    // Poll for emails
    const processed = await pollStockEmails(config);
    
    // Save data to localStorage (in real app, save to database)
    if (processed.length > 0) {
      // Get existing data
      const existingData = typeof window !== 'undefined' 
        ? JSON.parse(localStorage.getItem("inventoryData") || "[]")
        : [];
      
      // Merge new data (replace if same width)
      const newData = processed[0].data; // Use first email's data
      
      // Store with timestamp
      if (typeof window !== 'undefined') {
        localStorage.setItem("inventoryData", JSON.stringify(newData));
        localStorage.setItem("inventoryUpdated", new Date().toISOString());
        localStorage.setItem("lastEmailSubject", processed[0].subject);
        localStorage.setItem("lastEmailFrom", processed[0].from);
      }
      
      console.log(`✅ Processed ${processed.length} emails`);
      
      return NextResponse.json({
        success: true,
        message: `Processed ${processed.length} stock report emails`,
        emails: processed.map(e => ({
          subject: e.subject,
          from: e.from,
          date: e.date,
          rows: e.data.length
        }))
      });
    }
    
    return NextResponse.json({
      success: true,
      message: "No new stock emails found",
      emails: []
    });
    
  } catch (error) {
    console.error("Poll error:", error);
    return NextResponse.json({
      success: false,
      message: "Error polling emails: " + (error as Error).message
    }, { status: 500 });
  }
}

/**
 * GET endpoint - test IMAP connection
 */
export async function GET() {
  const config = {
    user: process.env.IMAP_USER || "",
    password: process.env.IMAP_PASSWORD || "",
    host: process.env.IMAP_HOST || "",
    port: parseInt(process.env.IMAP_PORT || "993"),
    tls: process.env.IMAP_TLS !== "false"
  };
  
  if (!config.user || !config.password || !config.host) {
    return NextResponse.json({
      configured: false,
      message: "IMAP not configured",
      required_env_vars: ["IMAP_USER", "IMAP_PASSWORD", "IMAP_HOST", "IMAP_PORT", "IMAP_TLS"]
    });
  }
  
  // Test connection
  const connected = await testIMAPConnection(config);
  
  return NextResponse.json({
    configured: true,
    connected,
    config: {
      host: config.host,
      port: config.port,
      user: config.user,
      tls: config.tls
      // Don't show password!
    },
    message: connected ? "IMAP connection successful" : "IMAP connection failed"
  });
}
