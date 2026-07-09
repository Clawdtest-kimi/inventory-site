import { NextResponse } from "next/server";

export async function GET() {
  const config = {
    user: process.env.IMAP_USER || "",
    password: process.env.IMAP_PASSWORD || "",
    host: process.env.IMAP_HOST || "",
    port: parseInt(process.env.IMAP_PORT || "993"),
    tls: process.env.IMAP_TLS === "true",
  };

  if (!config.user || !config.password || !config.host) {
    return NextResponse.json({
      configured: false,
      message: "IMAP not configured",
    });
  }

  try {
    const imaps = await import("imap-simple");
    
    const connection = await imaps.connect({ imap: config });
    await connection.openBox("INBOX");
    await connection.end();
    
    return NextResponse.json({
      success: true,
      message: "IMAP connection successful",
    });
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: error.message,
      error: error.toString(),
    }, { status: 500 });
  }
}
