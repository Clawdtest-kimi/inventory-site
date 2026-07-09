import { parseStockFile } from "./email-parser";

/**
 * IMAP Email Poller
 * Checks inbox for stock report emails and processes them
 */

interface IMAPConfig {
  user: string;
  password: string;
  host: string;
  port: number;
  tls: boolean;
}

interface ProcessedEmail {
  uid: number;
  subject: string;
  from: string;
  date: Date;
  data: any[];
}

/**
 * Poll IMAP inbox for stock emails
 * This would be called by a cron job every X minutes
 */
export async function pollStockEmails(config: IMAPConfig): Promise<ProcessedEmail[]> {
  // Dynamic import to avoid loading in browser
  const imaps = await import("imap-simple");
  const { simpleParser } = await import("mailparser");
  
  const connection = await imaps.connect({
    imap: config,
    onmail: (numNewMsgs) => {
      console.log(`📧 ${numNewMsgs} new messages`);
    }
  });

  try {
    await connection.openBox("INBOX");
    
    // Search for unread emails with stock-related subjects
    // Also check recent emails (last 24 hours) that might have been missed
    const searchCriteria = [
      "UNSEEN",
      ["SINCE", new Date(Date.now() - 24 * 60 * 60 * 1000)],
      ["OR", 
        ["SUBJECT", "stock"],
        ["SUBJECT", "inventory"],
        ["SUBJECT", "daily report"],
        ["SUBJECT", "free stock"]
      ]
    ];
    
    const fetchOptions = {
      bodies: ["HEADER.FIELDS (FROM TO SUBJECT DATE)", "TEXT"],
      markSeen: true // Mark as read after processing
    };
    
    const messages = await connection.search(searchCriteria, fetchOptions);
    
    const processed: ProcessedEmail[] = [];
    
    for (const message of messages) {
      const uid = message.attributes.uid;
      const header = message.parts.find((p: any) => p.which === "HEADER.FIELDS (FROM TO SUBJECT DATE)");
      const textPart = message.parts.find((p: any) => p.which === "TEXT");
      
      if (!header || !textPart) continue;
      
      const subject = header.body.subject?.[0] || "";
      const from = header.body.from?.[0] || "";
      const dateStr = header.body.date?.[0] || "";
      
      console.log(`📨 Processing: ${subject} from ${from}`);
      
      // Parse the email body
      const emailText = textPart.body;
      
      // Try to extract stock data
      const stockData = await parseStockFile(emailText, "email.txt");
      
      if (stockData.length > 0) {
        console.log(`✅ Found ${stockData.length} rows`);
        
        processed.push({
          uid,
          subject,
          from,
          date: new Date(dateStr),
          data: stockData
        });
        
        // Here you would save to database
        // For now we just return the data
      }
    }
    
    return processed;
    
  } finally {
    await connection.end();
  }
}

/**
 * Test IMAP connection
 */
export async function testIMAPConnection(config: IMAPConfig): Promise<boolean> {
  try {
    const imaps = await import("imap-simple");
    
    const connection = await imaps.connect({ imap: config });
    await connection.openBox("INBOX");
    await connection.end();
    
    return true;
  } catch (error) {
    console.error("IMAP connection failed:", error);
    return false;
  }
}
