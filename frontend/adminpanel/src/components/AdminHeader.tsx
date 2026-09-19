"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/Button";
import { LogOut, Activity, Menu } from "lucide-react";
import { adminApi } from "@/lib/adminApi";

export const AdminHeader: React.FC<{ onToggleMobile?: () => void }> = ({ onToggleMobile }) => {
  const { admin, logout } = useAdminAuth();
  const pathname = usePathname();
  const [systemOk, setSystemOk] = useState<boolean | null>(null);

  useEffect(() => {
    adminApi
      .getSystemHealth()
      .then((res) => setSystemOk(res.overall === "healthy"))
      .catch(() => setSystemOk(false));
  }, []);

  // Compute title from route
  const getPageTitle = () => {
    if (pathname === "/dashboard") return "Operational Overview";
    if (pathname.startsWith("/users")) return "User Management";
    if (pathname.startsWith("/jobs")) return "Video Processing Jobs";
    if (pathname.startsWith("/clips")) return "Generated Clips Library";
    if (pathname.startsWith("/storage")) return "Media & Storage Cleanup";
    if (pathname.startsWith("/system")) return "System Health & Diagnostics";
    if (pathname.startsWith("/logs")) return "System Application Logs";
    if (pathname.startsWith("/audit-logs")) return "Administrative Audit Trail";
    if (pathname.startsWith("/settings")) return "Global Settings & Access Control";
    return "Admin Portal";
  };

  return (
    <header className="h-16 bg-[#0a0b0d] border-b border-[#24272e] px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobile}
          className="md:hidden p-2 text-gray-400 hover:text-white bg-[#14161a] border border-[#272a31]"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex flex-col">
          <h1 className="text-sm sm:text-base font-bold uppercase tracking-tight text-white font-mono">
            {getPageTitle()}
          </h1>
          <span className="text-[10px] font-mono text-gray-400">
            Route: {pathname}
          </span>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-3">
        {/* System Health beacon */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-[#141518] border border-[#26282f] text-[10px] uppercase font-mono">
          <span
            className={`w-2 h-2 ${
              systemOk === true ? "bg-emerald-500" : systemOk === false ? "bg-rose-500" : "bg-amber-500"
            }`}
          />
          <span className="text-gray-300 font-bold">
            {systemOk === true ? "Services Online" : systemOk === false ? "Services Degraded" : "Pinging"}
          </span>
        </div>

        {/* Role badge */}
        {admin && <StatusBadge status={admin.role} />}

        {/* Admin profile & Logout */}
        {admin && (
          <div className="flex items-center gap-2">
            <span className="hidden lg:inline text-xs font-mono text-gray-400 border border-[#2b2e36] bg-[#141518] px-2.5 py-1">
              {admin.email}
            </span>
            <Button variant="outline" size="sm" onClick={logout} className="flex items-center gap-1.5">
              <LogOut className="w-3 h-3" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        )}
      </div>
    </header>
  );
};
