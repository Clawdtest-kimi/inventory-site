"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseStockFile } from "@/lib/email-parser";
import { CheckCircle, XCircle, FileText, Clock, RefreshCw } from "lucide-react";

interface UploadLog {
  id: string;
  fileName: string;
  timestamp: string;
  size: number;
  success: boolean;
  rows?: number;
  error?: string;
  source?: string;
}

export default function MasterPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [debugInfo, setDebugInfo] = useState("");
  const [uploadLog, setUploadLog] = useState<UploadLog[]>([]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Load upload log from localStorage
  const loadLogs = async () => {
    setUploading(true);
    setMessage("");
    
    const saved = localStorage.getItem("uploadLog");
    const localLogs: UploadLog[] = saved ? JSON.parse(saved) : [];
    setUploadLog(localLogs);
    setMessage("✅ Log refreshed");
    setUploading(false);
  };
  
  // Initial load only once
  useEffect(() => {
    if (session) {
      loadLogs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const addToLog = (entry: UploadLog) => {
    setUploadLog(prev => {
      const newLog = [entry, ...prev].slice(0, 50);
      localStorage.setItem("uploadLog", JSON.stringify(newLog));
      return newLog;
    });
  };

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    setMessage("");
    
    const logEntry: UploadLog = {
      id: Date.now().toString(),
      fileName: file.name,
      timestamp: new Date().toISOString(),
      size: file.size,
      success: false
    };

    try {
      const text = await file.text();
      const data = await parseStockFile(text, file.name);
      
      if (data.length === 0) {
        const preview = text.substring(0, 500).replace(/\n/g, ' | ');
        setDebugInfo(`File preview: ${preview}...`);
        setMessage("❌ No data found. The parser couldn't find a valid stock table.");
        logEntry.error = "No data found - invalid stock table";
        addToLog(logEntry);
        setUploading(false);
        return;
      }
      
      setDebugInfo("");
      
      // Store in localStorage
      const updatedAt = new Date().toISOString();
      localStorage.setItem("inventoryData", JSON.stringify(data));
      localStorage.setItem("inventoryUpdated", updatedAt);
      
      // Dispatch storage event to notify Stock page
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'inventoryData',
        newValue: JSON.stringify(data)
      }));
      
      logEntry.success = true;
      logEntry.rows = data.length;
      addToLog(logEntry);
      
      setMessage(`✅ Successfully uploaded! ${data.length} rows loaded from ${file.name}.`);
    } catch (error) {
      console.error("Upload error:", error);
      logEntry.error = (error as Error).message;
      addToLog(logEntry);
      setMessage("❌ Error parsing file: " + (error as Error).message);
    } finally {
      setUploading(false);
    }
  }, []);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

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
          </div>

          <Button 
            onClick={() => router.push("/")} 
            variant="outline"
          >
            View Inventory
          </Button>

          {/* Upload Log */}
          <div className="border-t pt-6 mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Upload Log
              </h3>
              <Button 
                onClick={loadLogs} 
                size="sm" 
                variant="outline"
                disabled={uploading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${uploading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
            
            {uploadLog.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No uploads yet</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {uploadLog.map((entry) => (
                  <div 
                    key={entry.id} 
                    className={`p-3 rounded-lg text-sm flex items-center justify-between ${
                      entry.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {entry.success ? (
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate" title={entry.fileName}>
                          {entry.fileName}
                        </p>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(entry.timestamp).toLocaleString()}
                          {entry.size > 0 && (
                            <>
                              <span className="mx-1">•</span>
                              {formatFileSize(entry.size)}
                            </>
                          )}
                          {entry.rows !== undefined && (
                            <>
                              <span className="mx-1">•</span>
                              <span className={entry.success ? 'text-green-600' : 'text-red-600'}>
                                {entry.rows} rows
                              </span>
                            </>
                          )}
                        </p>
                        {entry.error && (
                          <p className="text-xs text-red-600 mt-1">{entry.error}</p>
                        )}
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-medium ${
                      entry.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {entry.success ? 'SUCCESS' : 'FAILED'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}