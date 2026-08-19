import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

// Simple in-memory brute-force protection
// Tracks failed attempts per IP — locks out after 5 failures for 15 minutes
const failedAttempts = new Map<string, { count: number; lockedUntil: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = failedAttempts.get(ip);

  if (record && record.lockedUntil > now) {
    return { allowed: false, remaining: 0 };
  }

  if (record && record.lockedUntil <= now) {
    failedAttempts.delete(ip);
  }

  const count = record?.count || 0;
  return { allowed: count < MAX_ATTEMPTS, remaining: MAX_ATTEMPTS - count };
}

function recordFailure(ip: string) {
  const now = Date.now();
  const record = failedAttempts.get(ip) || { count: 0, lockedUntil: 0 };
  record.count += 1;
  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_MS;
  }
  failedAttempts.set(ip, record);

  // Clean old entries periodically
  if (failedAttempts.size > 100) {
    for (const [key, val] of failedAttempts) {
      if (val.lockedUntil <= now && val.count < MAX_ATTEMPTS) {
        failedAttempts.delete(key);
      }
    }
  }
}

function clearFailures(ip: string) {
  failedAttempts.delete(ip);
}

// Get client IP from NextAuth request headers
function getClientIP(req: any): string {
  const headers = req?.headers || {};
  return headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
         headers["x-real-ip"] ||
         "unknown";
}

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials, req) {
        // Brute-force protection
        const ip = getClientIP(req);
        const { allowed, remaining } = checkRateLimit(ip);
        if (!allowed) {
          // Return null silently — don't reveal lockout to attacker
          return null;
        }

        const adminPassword = process.env.ADMIN_PASSWORD || '';
        if (credentials?.username === "Admin" && credentials?.password === adminPassword) {
          clearFailures(ip);
          return { id: "1", name: "Admin", email: "admin@inventory.local" }
        }

        recordFailure(ip);
        return null
      }
    })
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 2 * 60 * 60, // 2 hours — auto-logout
    updateAge: 30 * 60,   // refresh token every 30 min
  },
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: true
      }
    }
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.role = "admin"
      return token
    },
    async session({ session, token }) {
      if (session.user) (session.user as any).role = token.role
      return session
    }
  }
})

export { handler as GET, handler as POST }