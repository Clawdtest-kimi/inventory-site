"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import Image from "next/image";

export function Header() {
  const { data: session, status } = useSession();

  return (
    <header className="bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <Link href="/" className="flex items-center space-x-4">
            <Image 
              src="/logo.png" 
              alt="Company Logo" 
              width={150} 
              height={50} 
              className="h-12 w-auto object-contain"
            />
            <div className="hidden sm:block h-8 w-px bg-slate-300" />
            <span className="hidden sm:block text-xl font-semibold text-slate-800">
              Inventory
            </span>
          </Link>

          <nav className="flex items-center space-x-4">
            <Link 
              href="/" 
              className="text-slate-600 hover:text-slate-900 font-medium transition-colors"
            >
              Stock
            </Link>
            
            {session?.user ? (
              <>
                <Link 
                  href="/master" 
                  className="text-slate-600 hover:text-slate-900 font-medium transition-colors"
                >
                  Upload
                </Link>
                <Link 
                  href="/imap-config" 
                  className="text-slate-600 hover:text-slate-900 font-medium transition-colors"
                >
                  Email Config
                </Link>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => signOut({ callbackUrl: "/login" })}
                >
                  Logout
                </Button>
              </>
            ) : (
              <Link href="/login">
                <Button variant="outline" size="sm">
                  Login
                </Button>
              </Link>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
