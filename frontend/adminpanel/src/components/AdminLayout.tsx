"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { AdminSidebar } from "@/components/AdminSidebar";
import { AdminHeader } from "@/components/AdminHeader";

export const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { admin, isLoading } = useAdminAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !admin && pathname !== "/login" && pathname !== "/login") {
      router.push("/login");
    }
  }, [admin, isLoading, pathname, router]);

  // If on login page, just show content without sidebar
  if (pathname === "/login" || pathname === "/login") {
    return <div className="min-h-screen bg-[#0a0b0d] text-white flex flex-col">{children}</div>;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0b0d] text-gray-400 font-mono text-xs flex items-center justify-center">
        Authenticating Administrator...
      </div>
    );
  }

  if (!admin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0a0b0d] text-[#f3f4f6] flex flex-row">
      {/* Desktop Sidebar */}
      <div className="hidden md:block w-64 flex-shrink-0 sticky top-0 h-screen">
        <AdminSidebar />
      </div>

      {/* Mobile Drawer */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="w-64 h-full bg-[#0e0f12]">
            <AdminSidebar onCloseMobile={() => setMobileDrawerOpen(false)} />
          </div>
          <div
            className="flex-1 bg-black/70"
            onClick={() => setMobileDrawerOpen(false)}
          />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <AdminHeader onToggleMobile={() => setMobileDrawerOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 flex flex-col max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
