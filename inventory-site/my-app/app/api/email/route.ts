import { NextRequest, NextResponse } from "next/server";
import { parseStockFile } from "@/lib/email-parser";

/**
 * Email webhook endpoint
 * Receives emails from email services (Mailgun, SendGrid, AWS SES, etc.)
 * and extracts stock table data
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    // Extract email fields (common formats from email providers)
    const from = formData.get("from") as string || "";
    const to = formData.get("to") as string || "";
    const subject = formData.get("subject") as string || "";
    const body = formData.get("body") as string || "";
    const text = formData.get("text") as string || formData.get("body-plain") as string || "";
    const html = formData.get("html") as string || formData.get("body-html") as string || "";
    
    // Check if it's a stock report email
    const isStockReport = 
      subject.toLowerCase().includes("stock") ||
      subject.toLowerCase().includes("inventory") ||
      subject.toLowerCase().includes("daily report") ||
      text.toLowerCase().includes("width") ||
      text.toLowerCase().includes("reels");
    
    if (!isStockReport) {
      return NextResponse.json({ 
        success: false, 
        message: "Not a stock report email" 
      }, { status: 400 });
    }
    
    // Try to parse the email content
    // Use text body first, then HTML
    const contentToParse = text || html || body;
    
    if (!contentToParse) {
      return NextResponse.json({ 
        success: false, 
        message: "No email body found" 
      }, { status: 400 });
    }
    
    // Parse the stock table from email
    const data = await parseStockFile(contentToParse, "email.txt");
    
    if (data.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: "No stock data found in email" 
      }, { status: 400 });
    }
    
    // Here you would store the data in a database
    // For now, we'll just return success
    // In production, you'd save to DB and maybe send a confirmation
    
    console.log(`📧 Received stock email from ${from}`);
    console.log(`📊 Parsed ${data.length} rows`);
    console.log(`📋 Subject: ${subject}`);
    
    return NextResponse.json({
      success: true,
      message: `Successfully parsed ${data.length} rows from email`,
      data: {
        rows: data.length,
        from: from,
        subject: subject,
        date: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error("Error processing email:", error);
    return NextResponse.json({
      success: false,
      message: "Error processing email: " + (error as Error).message
    }, { status: 500 });
  }
}

/**
 * GET endpoint for testing - shows webhook URL info
 */
export async function GET() {
  return NextResponse.json({
    message: "Email webhook endpoint",
    usage: "POST email data here from your email service",
    supportedFormats: ["form-data (Mailgun, SendGrid style)", "multipart/form-data"],
    requiredFields: ["from", "to", "subject", "body or text or html"]
  });
}
