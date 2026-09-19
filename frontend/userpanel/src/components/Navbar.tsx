"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { Scissors, LogOut, History, Menu, X } from "lucide-react";

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [backendOk, setBackendOk] = useState<boolean>(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    api
      .getHealth()
      .then((res) => {
        if (res.status !== "ok") {
          setBackendOk(false);
        }
      })
      .catch(() => setBackendOk(false));
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full bg-[#0a0b0d] border-b border-[#24272e]">
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 bg-amber-500 text-black flex items-center justify-center font-black text-sm border border-amber-500 flex-shrink-0">
              <Scissors className="w-4 h-4 stroke-[2.5]" />
            </div>
            <span className="text-base font-black tracking-tight uppercase">
              <span className="text-white">Clip</span>
              <span className="text-amber-500">Craft</span>
            </span>
          </Link>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-1">
            <Link
              href="/"
              className="px-3 py-1.5 text-xs uppercase font-medium tracking-wider text-gray-400 hover:text-white hover:bg-[#14161a] transition-colors"
            >
              Overview
            </Link>
            <Link
              href="/dashboard"
              className={`px-3 py-1.5 text-xs uppercase font-medium tracking-wider transition-colors ${
                pathname === "/dashboard"
                  ? "bg-[#14161a] text-amber-400 font-bold border border-[#26282f]"
                  : "text-gray-400 hover:text-white hover:bg-[#14161a]"
              }`}
            >
              Clipper Dashboard
            </Link>
            <div suppressHydrationWarning className="inline-flex">
              {user && (
                <Link
                  href="/history"
                  className={`px-3 py-1.5 text-xs uppercase font-medium tracking-wider transition-colors flex items-center gap-1.5 ${
                    pathname === "/history"
                      ? "bg-[#14161a] text-amber-400 font-bold border border-[#26282f]"
                      : "text-gray-400 hover:text-white hover:bg-[#14161a]"
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Job History</span>
                </Link>
              )}
            </div>
          </nav>
        </div>

        {/* Status & Auth actions */}
        <div className="hidden md:flex items-center gap-3 min-w-[200px] justify-end" suppressHydrationWarning>
          {/* Health indicator - defaults to Online to prevent flicker */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#141518] border border-[#26282f] text-[11px] text-gray-400 uppercase font-mono">
            <span
              className={`w-2 h-2 ${
                backendOk
                  ? "bg-emerald-500"
                  : "bg-rose-500"
              }`}
            />
            <span>
              {backendOk
                ? "API Online"
                : "API Offline"}
            </span>
          </div>

          {/* User Auth Info & Logout — Zero Flicker */}
          <div suppressHydrationWarning className="inline-flex items-center">
            {user ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-gray-400 border border-[#2b2e36] bg-[#141518] px-2.5 py-1 max-w-[180px] truncate">
                  {user.email}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={logout}
                  className="flex items-center gap-1.5 font-semibold text-gray-300 hover:text-white"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Logout</span>
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login">
                  <Button variant="outline" size="sm" className="font-semibold text-gray-300 hover:text-white">
                    Sign In
                  </Button>
                </Link>
                <Link href="/register">
                  <Button variant="primary" size="sm" className="font-bold">
                    Register
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Hamburger */}
        <div className="flex md:hidden items-center gap-2">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-gray-400 hover:text-white bg-[#14161a] border border-[#272a31]"
            aria-label="Toggle Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden w-full bg-[#0e0f12] border-b border-[#24272e] px-4 py-4 flex flex-col gap-3">
          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className="px-3 py-2 text-xs uppercase font-semibold text-gray-300 hover:bg-[#16181d] border border-transparent hover:border-[#282b33]"
          >
            Overview
          </Link>
          <Link
            href="/dashboard"
            onClick={() => setMobileMenuOpen(false)}
            className="px-3 py-2 text-xs uppercase font-semibold text-gray-300 hover:bg-[#16181d] border border-transparent hover:border-[#282b33]"
          >
            Clipper Dashboard
          </Link>
          <div suppressHydrationWarning className="flex flex-col">
            {user && (
              <Link
                href="/history"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 text-xs uppercase font-semibold text-gray-300 hover:bg-[#16181d] border border-transparent hover:border-[#282b33]"
              >
                Job History
              </Link>
            )}
          </div>

          <div className="pt-3 border-t border-[#22252c] flex flex-col gap-2" suppressHydrationWarning>
            {user ? (
              <div className="flex flex-col gap-2">
                <span className="text-xs font-mono text-gray-400 border border-[#2b2e36] bg-[#141518] px-3 py-1.5 text-center truncate">
                  {user.email}
                </span>
                <Button variant="outline" size="md" onClick={logout} className="w-full">
                  Logout
                </Button>
              </div>
            ) : (
              <>
                <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="outline" size="md" className="w-full">
                    Sign In
                  </Button>
                </Link>
                <Link href="/register" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="primary" size="md" className="w-full">
                    Register
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
