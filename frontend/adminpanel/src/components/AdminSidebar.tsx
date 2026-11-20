"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Video,
  Film,
  HardDrive,
  Activity,
  ShieldAlert,
  Settings,
  ArrowUpRight,
  Loader2,
} from "lucide-react";

import { AdminLogo } from "@/components/AdminLogo";

export const AdminSidebar: React.FC<{ onCloseMobile?: () => void }> = ({ onCloseMobile }) => {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  // Clear pending state once pathname updates
  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Users", href: "/users", icon: Users },
    { label: "Jobs", href: "/jobs", icon: Video },
    { label: "Clips", href: "/clips", icon: Film },
    { label: "Storage", href: "/storage", icon: HardDrive },
    { label: "System Health", href: "/system", icon: Activity },
    { label: "Audit Logs", href: "/audit-logs", icon: ShieldAlert },
    { label: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <aside className="w-64 bg-[#0e0f12] border-r border-[#24272e] flex flex-col justify-between h-full">
      {/* Brand Header */}
      <div>
        <div className="h-16 px-5 border-b border-[#24272e] flex items-center justify-between">
          <Link href="/dashboard" prefetch={true} className="flex items-center gap-2.5">
            <AdminLogo size={28} />
            <div className="flex flex-col">
              <span className="text-xs font-black uppercase tracking-tight text-white leading-none">
                ClipCraft <span className="text-red-500">Admin</span>
              </span>
              <span className="text-[9px] font-mono text-gray-400 uppercase tracking-widest mt-0.5">
                Ops Control
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation List */}
        <nav className="p-3 flex flex-col gap-1">
          <div className="px-3 py-1.5 text-[10px] font-mono uppercase text-gray-400 tracking-wider">
            Management
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const currentPath = pendingHref || pathname;
            const isActive = currentPath === item.href || (item.href !== "/dashboard" && currentPath.startsWith(item.href));
            const isPendingThis = pendingHref === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                onClick={() => {
                  if (pathname !== item.href) {
                    setPendingHref(item.href);
                  }
                  onCloseMobile?.();
                }}
                className={`px-3 py-2 text-xs font-mono uppercase tracking-wider flex items-center justify-between transition-colors border ${
                  isActive
                    ? "bg-[#1f1214] text-red-400 border-red-600 font-bold"
                    : "text-gray-400 hover:text-white hover:bg-[#121418] border-transparent hover:border-[#24272e]"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? "text-red-400" : "text-gray-400"}`} />
                  <span>{item.label}</span>
                </div>
                {isPendingThis && (
                  <Loader2 className="w-3 h-3 text-red-400 animate-spin" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Backlink to Public App */}
      <div className="p-3 border-t border-[#24272e]">
        <a
          href={process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-2 text-[11px] font-mono uppercase tracking-wider text-gray-400 hover:text-white bg-[#121316] hover:bg-[#181a1f] border border-[#272a31] flex items-center justify-between transition-colors"
        >
          <span>Open Main App</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </a>
      </div>
    </aside>
  );
};
