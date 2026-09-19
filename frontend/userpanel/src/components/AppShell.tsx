"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Navbar } from "@/components/Navbar";

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const isLandingPage = pathname === "/";

  // Landing Page
  if (isLandingPage) {
    return <main className="w-full flex flex-col flex-1">{children}</main>;
  }

  // Normal App Pages (Dashboard, History, Jobs, Login, Register)
  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col">
        {children}
      </main>
      <footer className="w-full border-t border-[#1e2025] bg-[#0c0d10] py-4">
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400 font-mono">
          <div className="flex items-center gap-1.5 uppercase">
            <span>&copy; {new Date().getFullYear()}</span>
            <span className="font-bold">
              <span className="text-white">Clip</span>
              <span className="text-amber-500">Craft</span>
            </span>
            <span className="text-gray-600">&bull;</span>
            <span>All rights reserved.</span>
            <span className="text-gray-600">&bull;</span>
            <span className="text-gray-500">Autonomous Video Utility</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-400 font-mono">
            <span>Built by Team</span>
            <span className="font-bold">
              <span className="text-gray-200">Hack</span>
              <span className="text-purple-500">Scouts</span>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};
