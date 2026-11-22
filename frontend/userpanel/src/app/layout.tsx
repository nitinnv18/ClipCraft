import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { VideoProcessingProvider } from "@/context/VideoProcessingContext";
import { AppShell } from "@/components/AppShell";
import { SmoothScrollProvider } from "@/components/SmoothScrollProvider";
import { DesktopOnlyGuard } from "@/components/DesktopOnlyGuard";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";

export const metadata: Metadata = {
  title: "ClipCraft",
  description:
    "Automatically find the best moments in your long-form videos and turn them into short, ready-to-share vertical clips.",
  keywords: [
    "AI video clipping",
    "YouTube shorts generator",
    "video repurposing",
    "automatic video editor",
    "9:16 vertical video",
    "transcript moment detection",
    "auto subtitle burner",
  ],
  authors: [{ name: "ClipCraft" }],
  openGraph: {
    title: "ClipCraft",
    description:
      "Automatically find the best moments in your long-form videos and turn them into short, ready-to-share vertical clips.",
    type: "website",
    locale: "en_US",
    siteName: "ClipCraft",
  },
  twitter: {
    card: "summary_large_image",
    title: "ClipCraft",
    description:
      "Automatically find the best moments in your long-form videos and turn them into short, ready-to-share vertical clips.",
  },
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read verified session server-side for 0-blink SSR directly from cookie (instant, 0ms network latency)
  const cookieStore = await cookies();
  const token = cookieStore.get("clipcraft_token")?.value;
  const userCookie = cookieStore.get("clipcraft_user")?.value;
  let initialUser = null;

  if (token && userCookie) {
    try {
      initialUser = JSON.parse(decodeURIComponent(userCookie));
    } catch {
      initialUser = null;
    }
  }

  return (
    <html lang="en" className="dark scroll-smooth">
      <body className="min-h-screen bg-[#0a0b0d] text-[#f3f4f6] flex flex-col antialiased selection:bg-amber-500 selection:text-black">
        {/* Google Analytics 4 Tag (GA4) with SPA Pageview Tracking & Default Fallback */}
        <GoogleAnalytics />
        <DesktopOnlyGuard>
          <SmoothScrollProvider>
            <AuthProvider initialUser={initialUser}>
              <VideoProcessingProvider>
                <AppShell>{children}</AppShell>
              </VideoProcessingProvider>
            </AuthProvider>
          </SmoothScrollProvider>
        </DesktopOnlyGuard>
      </body>
    </html>
  );
}
