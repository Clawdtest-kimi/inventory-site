"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RefreshCw, CheckCircle, XCircle, Clock } from "lucide-react";

interface PollerStatus {
  lastChecked: string | null;
  lastEmailCount: number;
  isRunning: boolean;
  error: string | null;
}

export default function IMAPConfigPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<any>(null);
  const [pollerStatus, setPollerStatus] = useState<PollerStatus>({
    lastChecked: null,
    lastEmailCount: 0,
    isRunning: false,
    error: null
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Load last status from localStorage
  useEffect(() => {
    if (session) {
      const saved = localStorage.getItem("pollerStatus");
      if (saved) {
        setPollerStatus(JSON.parse(saved));
      }
    }
  }, [session]);

  const checkStatus = async () => {
    setLoading(true);
    setMessage("");
    
    try {
      const res = await fetch("/api/email");
      const data = await res.json();
      
      const newStatus: PollerStatus = {
        lastChecked: new Date().toISOString(),
        lastEmailCount: data.emails?.length || 0,
        isRunning: data.status === "ok",
        error: data.error || null
      };
      
      setPollerStatus(newStatus);
      localStorage.setItem("pollerStatus", JSON.stringify(newStatus));
      setMessage("✅ Status checked successfully");
    } catch (error) {
      const newStatus: PollerStatus = {
        lastChecked: new Date().toISOString(),
        lastEmailCount: 0,
        isRunning: false,
        error: "API unreachable"
      };
      setPollerStatus(newStatus);
      localStorage.setItem("pollerStatus", JSON.stringify(newStatus));
      setMessage("❌ Could not check status. Local poller may not be running.");
    }
    
    setLoading(false);
  };

  const handleTestConnection = async () => {
    setLoading(true);
    setMessage("");
    
    try {
      const res = await fetch("/api/poll-email");
      const data = await res.json();
      setConnectionStatus(data);
      
      if (data.connected) {
        setMessage("✅ IMAP connection successful!");
      } else if (data.configured) {
        setMessage("❌ IMAP connection failed. Check credentials.");
      } else {
        setMessage("⚠️ IMAP not configured. Set environment variables in Vercel.");
      }
    } catch (error) {
      setMessage("❌ Error testing connection");
    }
    
    setLoading(false);
  };

  const handlePollNow = async () => {
    setLoading(true);
    setMessage("");
    
    try {
      const res = await fetch("/api/poll-email", { method: "POST" });
      const data = await res.json();
      
      if (data.success) {
        setMessage(`✅ ${data.message}`);
        if (data.emails?.length > 0) {
          setMessage(prev => `${prev}\n📧 Found: ${data.emails.map((e: any) => e.subject).join(", ")}`);
        }
      } else {
        setMessage(`❌ ${data.message}`);
      }
    } catch (error) {
      setMessage("❌ Error polling emails. Note: IMAP polling runs locally on your Mac, not on Vercel.");
    }
    
    setLoading(false);
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
          <CardTitle>IMAP Email Configuration</CardTitle>
          <CardDescription>
            Configure IMAP polling to automatically receive stock reports via email
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status */}
          <div className="bg-slate-50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Local Email Poller Status</h3>
              <Button onClick={checkStatus} disabled={loading} size="sm" variant="outline">
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Check Status
              </Button>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                {pollerStatus.isRunning ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-green-600 font-medium">Running</span>
                  </>
                ) : pollerStatus.error ? (
                  <>
                    <XCircle className="w-4 h-4 text-red-600" />
                    <span className="text-red-600 font-medium">Not Running</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4 text-yellow-600" />
                    <span className="text-yellow-600 font-medium">Unknown - click Check Status</span>
                  </>
                )}
              </div>
              
              {pollerStatus.lastChecked && (
                <p className="text-slate-600">
                  <span className="font-medium">Last checked:</span>{" "}
                  {new Date(pollerStatus.lastChecked).toLocaleString()}
                </p>
              )}
              
              {pollerStatus.lastEmailCount > 0 && (
                <p className="text-slate-600">
                  <span className="font-medium">Emails found:</span> {pollerStatus.lastEmailCount}
                </p>
              )}
              
              {pollerStatus.error && (
                <p className="text-red-600 text-xs">{pollerStatus.error}</p>
              )}
              
              <div className="text-xs text-slate-500 mt-2 pt-2 border-t">
                <p>Email: stock@packaging.team</p>
                <p>Server: mail.privateemail.com:993</p>
                <p>Checks every 15 minutes via local Mac</p>
              </div>
            </div>
          </div>

          {message && (
            <div className={`p-4 rounded-lg whitespace-pre-line ${message.includes("✅") ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
              {message}
            </div>
          )}

          {/* Setup Instructions */}
          <div className="bg-blue-50 p-4 rounded-lg space-y-3">
            <h3 className="font-semibold text-blue-900">Local Poller Setup (Mac)</h3>
            
            <div className="text-sm text-blue-800 space-y-2">
              <p><strong>1. Email configured:</strong> <code>stock@packaging.team</code></p>
              
              <p><strong>2. Current settings:</strong></p>
              <div className="bg-white p-3 rounded font-mono text-xs space-y-1">
                <p>IMAP_USER=stock@packaging.team</p>
                <p>IMAP_HOST=mail.privateemail.com</p>
                <p>IMAP_PORT=993</p>
                <p>IMAP_TLS=true</p>
              </div>
              
              <p><strong>3. Check local poller status on your Mac:</strong></p>
              <code className="bg-white px-2 py-1 rounded">launchctl list | grep emailpoller</code>
              
              <p><strong>4. View logs:</strong></p>
              <code className="bg-white px-2 py-1 rounded">tail -f /tmp/email-poller.log</code>
              
              <p><strong>5. Run manually:</strong></p>
              <code className="bg-white px-2 py-1 rounded">node email-poller.js</code>
            </div>
          </div>

          {/* Common Providers */}
          <div className="bg-slate-50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Common Email Provider Settings</h3>
            <div className="text-sm space-y-3">
              <div>
                <p className="font-medium">Google Workspace / Gmail</p>
                <p className="text-slate-600">Host: imap.gmail.com | Port: 993 | TLS: Yes</p>
                <p className="text-slate-500 text-xs">Note: Enable &quot;Less secure app access&quot; or use App Password</p>
              </div>
              <div>
                <p className="font-medium">Microsoft 365 / Outlook</p>
                <p className="text-slate-600">Host: outlook.office365.com | Port: 993 | TLS: Yes</p>
              </div>
              <div>
                <p className="font-medium">cPanel / Standard Hosting</p>
                <p className="text-slate-600">Host: mail.yourdomain.com | Port: 993 | TLS: Yes</p>
              </div>
            </div>
          </div>

          <Button onClick={() => router.push("/")} variant="outline">
            Back to Inventory
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
