"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Scissors, Menu, X, ArrowRight } from "lucide-react";

export const LandingNavbar: React.FC = () => {
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full bg-[#0a0b0d] border-b border-[#24272e]">
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand / Logo */}
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

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-1">
            <a
              href="#how-it-works"
              className="px-3 py-1.5 text-xs uppercase font-medium tracking-wider text-gray-400 hover:text-white hover:bg-[#14161a] transition-colors"
            >
              How It Works
            </a>
            <a
              href="#features"
              className="px-3 py-1.5 text-xs uppercase font-medium tracking-wider text-gray-400 hover:text-white hover:bg-[#14161a] transition-colors"
            >
              Features
            </a>
            <a
              href="#before-after"
              className="px-3 py-1.5 text-xs uppercase font-medium tracking-wider text-gray-400 hover:text-white hover:bg-[#14161a] transition-colors"
            >
              Comparison
            </a>
            <a
              href="#faq"
              className="px-3 py-1.5 text-xs uppercase font-medium tracking-wider text-gray-400 hover:text-white hover:bg-[#14161a] transition-colors"
            >
              FAQ
            </a>
          </nav>
        </div>

        {/* Right Actions — Instant Render with Hydration Suppression */}
        <div className="hidden md:flex items-center gap-3 min-w-[200px] justify-end" suppressHydrationWarning>
          {user ? (
            <Link href="/dashboard">
              <Button variant="primary" size="sm" className="flex items-center gap-1.5 font-bold">
                <span>Go to Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          ) : (
            <>
              <Link href="/login">
                <Button variant="outline" size="sm" className="font-semibold text-gray-300 hover:text-white">
                  Log in
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="primary" size="sm" className="font-bold flex items-center gap-1.5">
                  <span>Get Started</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </>
          )}
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
          <a
            href="#how-it-works"
            onClick={() => setMobileMenuOpen(false)}
            className="px-3 py-2 text-xs uppercase font-semibold text-gray-300 hover:bg-[#16181d] border border-transparent hover:border-[#282b33]"
          >
            How It Works
          </a>
          <a
            href="#features"
            onClick={() => setMobileMenuOpen(false)}
            className="px-3 py-2 text-xs uppercase font-semibold text-gray-300 hover:bg-[#16181d] border border-transparent hover:border-[#282b33]"
          >
            Features
          </a>
          <a
            href="#before-after"
            onClick={() => setMobileMenuOpen(false)}
            className="px-3 py-2 text-xs uppercase font-semibold text-gray-300 hover:bg-[#16181d] border border-transparent hover:border-[#282b33]"
          >
            Comparison
          </a>
          <a
            href="#faq"
            onClick={() => setMobileMenuOpen(false)}
            className="px-3 py-2 text-xs uppercase font-semibold text-gray-300 hover:bg-[#16181d] border border-transparent hover:border-[#282b33]"
          >
            FAQ
          </a>

          <div className="pt-3 border-t border-[#22252c] flex flex-col gap-2" suppressHydrationWarning>
            {user ? (
              <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="primary" size="md" className="w-full">
                  Go to Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="outline" size="md" className="w-full">
                    Log in
                  </Button>
                </Link>
                <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="primary" size="md" className="w-full">
                    Get Started
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
