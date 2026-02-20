"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function IMAPConfigPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<any>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Check current IMAP status on load
  useEffect(() => {
    if (session) {
      fetch("/api/poll-email")
        .then(res => res.json())
        .then(data => setConnectionStatus(data))
        .catch(() => setConnectionStatus({ configured: false }));
    }
  }, [session]);

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
      setMessage("❌ Error polling emails");
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
            <h3 className="font-semibold mb-2">Current Status</h3>
            {connectionStatus ? (
              <div className="space-y-1 text-sm">
                <p>
                  <span className="font-medium">Configured:</span>{" "}
                  {connectionStatus.configured ? (
                    <span className="text-green-600">Yes</span>
                  ) : (
                    <span className="text-red-600">No</span>
                  )}
                </p>
                {connectionStatus.configured && (
                  <>
                    <p><span className="font-medium">Server:</span> {connectionStatus.config?.host}:{connectionStatus.config?.port}</p>
                    <p><span className="font-medium">User:</span> {connectionStatus.config?.user}</p>
                    <p>
                      <span className="font-medium">Connection:</span>{" "}
                      {connectionStatus.connected ? (
                        <span className="text-green-600">Connected</span>
                      ) : (
                        <span className="text-red-600">Failed</span>
                      )}
                    </p>
                  </>
                )}
              </div>
            ) : (
              <p className="text-slate-500">Checking...</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <Button onClick={handleTestConnection} disabled={loading} variant="outline">
              Test Connection
            </Button>
            <Button onClick={handlePollNow} disabled={loading}>
              Poll Now
            </Button>
          </div>

          {message && (
            <div className={`p-4 rounded-lg whitespace-pre-line ${message.includes("✅") ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
              {message}
            </div>
          )}

          {/* Setup Instructions */}
          <div className="bg-blue-50 p-4 rounded-lg space-y-3">
            <h3 className="font-semibold text-blue-900">Setup Instructions</h3>
            
            <div className="text-sm text-blue-800 space-y-2">
              <p><strong>1. Create the email</strong> <code>stock@packaging.team</code> with your email provider</p>
              
              <p><strong>2. Get IMAP settings</strong> from your email provider:</p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Server address (e.g., <code>mail.packaging.team</code> or <code>imap.gmail.com</code>)</li>
                <li>Port (usually 993 for IMAP with TLS)</li>
                <li>Username and password</li>
              </ul>
              
              <p><strong>3. Set environment variables</strong> in Vercel dashboard:</p>
              <div className="bg-white p-3 rounded font-mono text-xs space-y-1">
                <p>IMAP_USER=stock@packaging.team</p>
                <p>IMAP_PASSWORD=your-email-password</p>
                <p>IMAP_HOST=mail.yourdomain.com</p>
                <p>IMAP_PORT=993</p>
                <p>IMAP_TLS=true</p>
              </div>
              
              <p><strong>4. Set up automatic polling</strong> (cron job):</p>
              <p>Add this cron job to check every 15 minutes:</p>
              <code className="bg-white px-2 py-1 rounded">*/15 * * * * curl -X POST https://my-app-brown-gamma-99.vercel.app/api/poll-email</code>
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
