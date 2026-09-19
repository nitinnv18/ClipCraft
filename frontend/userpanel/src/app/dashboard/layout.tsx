import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ClipCraft - Dashboard",
  description: "Manage your video clipping jobs, generate vertical shorts, and export clips.",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
