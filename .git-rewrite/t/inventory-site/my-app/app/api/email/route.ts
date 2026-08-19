import { NextRequest, NextResponse } from "next/server";
import { saveInventory, getInventory, getInventoryLog } from "@/lib/redis";

/**
 * API endpoint to receive stock data from local poller
 * Saves to Redis for persistence
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subject, from, data, receivedAt } = body;
    
    console.log("📧 Received stock data from local poller");
    console.log(`   Subject: ${subject}`);
    console.log(`   From: ${from}`);
    console.log(`   Rows: ${data?.length || 0}`);
    
    if (!data || data.length === 0) {
      return NextResponse.json({
        success: false,
        message: "No data received"
      }, { status: 400 });
    }
    
    // Save to Redis
    const source = from || subject || "Email";
    const result = await saveInventory(data, source);
    
    return NextResponse.json({
      success: true,
      message: `Saved ${data.length} rows`,
      timestamp: result.timestamp,
      data: data
    });
    
  } catch (error) {
    console.error("Email API error:", error);
    return NextResponse.json({
      success: false,
      message: "Error processing data: " + (error as Error).message
    }, { status: 500 });
  }
}

/**
 * GET - retrieve current inventory data
 */
export async function GET() {
  try {
    const inventory = await getInventory();
    const log = await getInventoryLog();
    
    if (!inventory) {
      return NextResponse.json({
        status: "ok",
        hasData: false,
        message: "No inventory data yet"
      });
    }
    
    return NextResponse.json({
      status: "ok",
      hasData: true,
      updatedAt: inventory.updatedAt,
      source: inventory.source,
      rows: inventory.data.length,
      data: inventory.data,
      log: log
    });
    
  } catch (error) {
    return NextResponse.json({
      status: "error",
      message: (error as Error).message
    }, { status: 500 });
  }
}
