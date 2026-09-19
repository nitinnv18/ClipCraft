import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AdminAuthProvider } from "@/context/AdminAuthContext";
import { AdminLayout } from "@/components/AdminLayout";
import { DesktopOnlyGuard } from "@/components/DesktopOnlyGuard";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "ClipCraft Admin Console",
  description: "Secure Administrative Operations and Monitoring Console for ClipCraft AI Video Clipping SaaS.",
  icons: {
    icon: [
      { url: "/admin-icon.svg?v=3", type: "image/svg+xml" },
      { url: "/icon.svg?v=3", type: "image/svg+xml" },
    ],
    shortcut: "/admin-icon.svg?v=3",
    apple: "/admin-icon.svg?v=3",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get("clipcraft_admin_user")?.value;
  let initialAdmin = null;
  if (adminCookie) {
    try {
      const decoded = Buffer.from(adminCookie, "base64").toString("utf-8");
      initialAdmin = JSON.parse(decoded);
    } catch (_) {
      try {
        initialAdmin = JSON.parse(decodeURIComponent(adminCookie));
      } catch (_) {
        try {
          initialAdmin = JSON.parse(adminCookie);
        } catch (_) {}
      }
    }
  }

  return (
    <html lang="en" className={`${inter.variable} ${mono.variable} dark`}>
      <head>
        <link rel="icon" href="/admin-icon.svg?v=3" type="image/svg+xml" />
        <link rel="shortcut icon" href="/admin-icon.svg?v=3" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/admin-icon.svg?v=3" />
      </head>
      <body className="bg-[#0a0b0d] text-[#f3f4f6] font-sans antialiased min-h-screen flex flex-col selection:bg-red-600 selection:text-white">
        <DesktopOnlyGuard>
          <AdminAuthProvider initialAdmin={initialAdmin}>
            <AdminLayout>{children}</AdminLayout>
          </AdminAuthProvider>
        </DesktopOnlyGuard>
      </body>
    </html>
  );
}
