import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import "./globals.css";
import { AdminAuthProvider } from "@/context/AdminAuthContext";
import { AdminLayout } from "@/components/AdminLayout";
import { DesktopOnlyGuard } from "@/components/DesktopOnlyGuard";
import { AdminProgressBar } from "@/components/AdminProgressBar";

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

function parseAdminCookie(val?: string) {
  if (!val) return null;
  try {
    const json = Buffer.from(val, "base64").toString("utf-8");
    return JSON.parse(json);
  } catch (_) {}
  try {
    return JSON.parse(decodeURIComponent(val));
  } catch (_) {}
  try {
    return JSON.parse(val);
  } catch (_) {}
  return null;
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const userCookie = cookieStore.get("clipcraft_admin_user")?.value;
  const initialAdmin = parseAdminCookie(userCookie);

  return (
    <html lang="en" className="dark">
      <head>
        <link rel="icon" href="/admin-icon.svg?v=3" type="image/svg+xml" />
        <link rel="shortcut icon" href="/admin-icon.svg?v=3" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/admin-icon.svg?v=3" />
      </head>
      <body className="bg-[#0a0b0d] text-[#f3f4f6] font-sans antialiased min-h-screen flex flex-col selection:bg-red-600 selection:text-white">
        <Suspense fallback={null}>
          <AdminProgressBar />
        </Suspense>
        <DesktopOnlyGuard>
          <AdminAuthProvider initialAdmin={initialAdmin}>
            <AdminLayout>{children}</AdminLayout>
          </AdminAuthProvider>
        </DesktopOnlyGuard>
      </body>
    </html>
  );
}
