"use client";

import React, { useState } from "react";
import { Monitor, Copy, Check, Clapperboard, Smartphone } from "lucide-react";

export const DesktopOnlyGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <>
      {/* 
        Mobile Screen Blocker:
        - Visible strictly on mobile viewports (< 768px).
        - Automatically unlocks when 'Desktop site' mode (>= 768px / 980px) is enabled in mobile browser.
      */}
      <div className="md:hidden fixed inset-0 z-[999999] bg-[#0a0b0d] text-[#f3f4f6] flex flex-col items-center justify-center p-6 overflow-y-auto selection:bg-amber-500 selection:text-black">
        {/* Background Subtle Accent */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent pointer-events-none" />

        <div className="relative w-full max-w-sm flex flex-col items-center text-center space-y-6 my-auto py-8">
          {/* Studio Brand Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#121316] border border-[#262931] text-[11px] font-mono uppercase tracking-widest text-amber-400">
            <Clapperboard className="w-3.5 h-3.5" />
            <span>Studio Workspace</span>
          </div>

          {/* Desktop Monitor Visual */}
          <div className="relative flex items-center justify-center w-20 h-20 bg-[#121316] border border-[#272a30] text-amber-400 shadow-2xl">
            <Monitor className="w-10 h-10" />
            <div className="absolute -bottom-2 -right-2 w-7 h-7 bg-[#1c1e24] border border-[#2e323b] flex items-center justify-center text-gray-400">
              <Smartphone className="w-3.5 h-3.5 text-red-400" />
            </div>
          </div>

          {/* Headline & Explanation */}
          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white">
              Desktop Experience Required
            </h1>
            <p className="text-xs text-gray-400 leading-relaxed">
              ClipCraft is an advanced AI video repurposing studio optimized for large screens.
            </p>
          </div>

          {/* Mobile Tip Box */}
          <div className="w-full bg-[#121316] border border-[#22252c] p-3.5 text-left text-xs text-gray-300 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-amber-400 font-mono uppercase text-[11px]">
              <span>💡 Access on Mobile:</span>
            </div>
            <p className="text-[12px] text-gray-400 leading-normal">
              Tap your browser menu (<span className="font-mono text-white">⋮</span> or <span className="font-mono text-white">aA</span>) and check <span className="text-white font-semibold">"Desktop site"</span> to open instantly.
            </p>
          </div>

          {/* Action: Copy Link */}
          <div className="w-full space-y-3 pt-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-400 text-black font-black uppercase text-xs tracking-wider flex items-center justify-center gap-2 transition-colors active:scale-[0.99]"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Link Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Link For Laptop</span>
                </>
              )}
            </button>

            <p className="text-[10px] font-mono uppercase text-gray-400 tracking-wider">
              Send this link to your computer via WhatsApp, Telegram, or Email
            </p>
          </div>
        </div>
      </div>

      {/* Main Desktop App Content (Auto-renders when Desktop Site is turned on >= 768px) */}
      <div className="max-md:hidden md:block">
        {children}
      </div>
    </>
  );
};
