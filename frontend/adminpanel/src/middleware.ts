import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const STATIC_ASSET_REGEX = /\.(ico|png|jpg|jpeg|svg|css|js|woff|woff2|webp|json)$/i;

function safeBase64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  return atob(base64);
}

function parseAdminJwtPayload(token: string): { sub?: string; exp?: number; type?: string; [key: string]: unknown } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const json = safeBase64UrlDecode(parts[1]);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function isValidAdminToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;

  try {
    const payload = parseAdminJwtPayload(token);
    if (!payload || !payload.sub || typeof payload.exp !== "number") return false;
    if (payload.type !== "admin") return false;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return false;

    // Optional cryptographic signature check if JWT_SECRET is configured in Next.js environment
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
        const rawSig = safeBase64UrlDecode(signatureB64);
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

    // In decoupled frontend/backend production deployments, structural integrity and admin claim
    // are verified at the edge router, and FastAPI cryptographically verifies every /api/admin request.
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static files, api routes, and Next.js internal paths
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    STATIC_ASSET_REGEX.test(pathname)
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get("clipcraft_admin_token")?.value;
  const hasValidToken = await isValidAdminToken(token);

  if (pathname.startsWith("/login")) {
    if (hasValidToken) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (!hasValidToken) {
    const loginUrl = new URL("/login", request.url);
    const safeRedirect = pathname.startsWith("/") && !pathname.startsWith("//") ? pathname : "/dashboard";
    loginUrl.searchParams.set("redirect", safeRedirect);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
