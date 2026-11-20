import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_ROUTES = ["/dashboard", "/history", "/jobs"];

function decodeBase64Url(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  return atob(base64);
}

function parseJwtPayload(token: string): { sub?: string; exp?: number; [key: string]: unknown } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const json = decodeBase64Url(parts[1]);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function isValidSessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;

  try {
    const payload = parseJwtPayload(token);
    if (!payload || !payload.sub || typeof payload.exp !== "number") return false;
    // Check if token has expired
    if (payload.exp <= Math.floor(Date.now() / 1000)) return false;

    // Optional HMAC signature check if JWT_SECRET is configured in Next.js environment
    const secret = process.env.JWT_SECRET;
    if (secret) {
      try {
        const [headerB64, payloadB64, signatureB64] = parts;
        const enc = new TextEncoder();
        const key = await crypto.subtle.importKey(
          "raw",
          enc.encode(secret),
          { name: "HMAC", hash: "SHA-256" },
          false,
          ["verify"]
        );
        const data = enc.encode(`${headerB64}.${payloadB64}`);
        const rawSig = decodeBase64Url(signatureB64);
        const sigBytes = new Uint8Array(rawSig.length);
        for (let i = 0; i < rawSig.length; i++) {
          sigBytes[i] = rawSig.charCodeAt(i);
        }
        const isValid = await crypto.subtle.verify("HMAC", key, sigBytes, data);
        return isValid;
      } catch {
        return false;
      }
    }

    // In decoupled frontend/backend production deployments, JWT_SECRET resides on the API backend.
    // Structural integrity and token validity are verified here at the edge router, and FastAPI
    // cryptographically verifies every authenticated request against the database.
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("clipcraft_token")?.value;
  const hasValidToken = await isValidSessionToken(token);

  // Redirect unauthenticated users trying to access protected paths
  const isProtected = PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
  if (isProtected && !hasValidToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect already authenticated users from login/register back to dashboard
  if ((pathname === "/login" || pathname === "/register") && hasValidToken) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/history/:path*", "/jobs/:path*", "/login", "/register"],
};
