"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseStockFile } from "@/lib/email-parser";

export default function MasterPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [debugInfo, setDebugInfo] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage("");

    try {
      const text = await file.text();
      console.log("File content preview:", text.substring(0, 1000));
      
      const data = parseStockFile(text, file.name);
      console.log("Parsed data:", data);
      
      if (data.length === 0) {
        // Show debug info to help diagnose
        const preview = text.substring(0, 500).replace(/\n/g, ' | ');
        setDebugInfo(`File preview: ${preview}...`);
        setMessage("❌ No data found. The parser couldn't find a valid stock table. Check browser console (F12) for details.");
        setUploading(false);
        return;
      }
      
      setDebugInfo("");
      
      // Store in localStorage for demo purposes
      localStorage.setItem("inventoryData", JSON.stringify(data));
      localStorage.setItem("inventoryUpdated", new Date().toISOString());
      
      setMessage(`✅ Successfully uploaded! ${data.length} rows loaded from ${file.name}.`);
    } catch (error) {
      console.error("Upload error:", error);
      setMessage("❌ Error parsing file: " + (error as Error).message);
    } finally {
      setUploading(false);
    }
  }, []);

  if (status === "loading") {
    return <div className="p-8 text-center">Loading...</div>;
  }

  if (!session) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Master Account - Stock Upload</CardTitle>
          <CardDescription>
            Upload a stock file (CSV or Email .eml) to update the inventory database
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="stock-file">Stock File</Label>
            <Input
              id="stock-file"
              type="file"
              accept=".csv,.eml,.txt"
              onChange={handleFileUpload}
              disabled={uploading}
            />
            <p className="text-sm text-slate-500">
              Supports: CSV files, Email (.eml) files with stock tables, or plain text tables
            </p>
          </div>

          {message && (
            <div className={`p-4 rounded-lg ${message.includes("✅") ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
              {message}
            </div>
          )}

          {debugInfo && (
            <div className="bg-slate-100 p-3 rounded text-xs font-mono break-all">
              <p className="font-semibold mb-1">Debug info:</p>
              {debugInfo}
            </div>
          )}

          <div className="bg-slate-50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Supported Formats:</h3>
            <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside">
              <li><strong>CSV:</strong> Width (mm), Reels/Qty pairs for each micron, Totals</li>
              <li><strong>Email (.eml):</strong> Forwarded stock report emails - table is auto-extracted</li>
              <li><strong>Text:</strong> Pipe-delimited or space-separated tables</li>
            </ul>
            <p className="text-sm text-slate-500 mt-2">
              For emails, only the stock table data is extracted - headers and text are ignored.
            </p>
          </div>

          <Button 
            onClick={() => router.push("/")} 
            variant="outline"
          >
            View Inventory
          </Button>

          <div className="border-t pt-4 mt-4">
            <h4 className="font-semibold mb-2">Troubleshooting:</h4>
            <p className="text-sm text-slate-600">
              If upload fails, open browser console (F12 → Console) to see what the parser found.
              You can also try copying the table content and saving as .csv file.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
