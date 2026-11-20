"use client";

import React, { useState } from "react";
import { Monitor, Copy, Check, ShieldAlert, Smartphone, ArrowRight } from "lucide-react";

interface DesktopOnlyGuardProps {
  children: React.ReactNode;
  enabled?: boolean;
}

export const DesktopOnlyGuard: React.FC<DesktopOnlyGuardProps> = ({
  children,
  enabled = true,
}) => {
  const [bypassed, setBypassed] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // If guard is disabled or administrator explicitly bypasses it, render app directly
  if (!enabled || bypassed) {
    return <>{children}</>;
  }

  return (
    <>
      {/* 
        Admin Mobile Screen Blocker:
        - Visible on mobile viewports (< 768px).
        - Automatically unlocks when 'Desktop site' mode (>= 768px) is enabled in mobile browser.
        - Configurable: admins can explicitly choose to continue on mobile or disable via props.
      */}
      <div className="md:hidden fixed inset-0 z-[999999] bg-[#0a0b0d] text-[#f3f4f6] flex flex-col items-center justify-center p-6 overflow-y-auto selection:bg-red-600 selection:text-white">
        <div className="relative w-full max-w-sm flex flex-col items-center text-center space-y-6 my-auto py-8">
          {/* Admin Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#161214] border border-[#3b1d22] text-[11px] font-mono uppercase tracking-widest text-red-400">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Admin Console</span>
          </div>

          {/* Desktop Visual */}
          <div className="relative flex items-center justify-center w-20 h-20 bg-[#121316] border border-[#272a30] text-red-400 shadow-2xl">
            <Monitor className="w-10 h-10" />
            <div className="absolute -bottom-2 -right-2 w-7 h-7 bg-[#1c1e24] border border-[#2e323b] flex items-center justify-center text-gray-400">
              <Smartphone className="w-3.5 h-3.5 text-red-500" />
            </div>
          </div>

          {/* Headline & Explanation */}
          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white">
              Desktop Screen Recommended
            </h1>
            <p className="text-xs text-gray-400 leading-relaxed">
              ClipCraft Admin Console is an enterprise operations workspace designed for desktop screens.
            </p>
          </div>

          {/* Mobile Tip Box */}
          <div className="w-full bg-[#121316] border border-[#22252c] p-3.5 text-left text-xs text-gray-300 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-red-400 font-mono uppercase text-[11px]">
              <span>💡 Access on Mobile:</span>
            </div>
            <p className="text-[12px] text-gray-400 leading-normal">
              For complete layout fidelity, tap browser menu (<span className="font-mono text-white">⋮</span> / <span className="font-mono text-white">aA</span>) and enable <span className="text-white font-semibold">&ldquo;Desktop site&rdquo;</span>.
            </p>
          </div>

          {/* Actions: Copy Link & Emergency Mobile Access */}
          <div className="w-full space-y-2.5 pt-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className="w-full py-3 px-4 bg-red-600 hover:bg-red-500 text-white font-black uppercase text-xs tracking-wider flex items-center justify-center gap-2 transition-colors active:scale-[0.99]"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Link Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Admin Console Link</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setBypassed(true)}
              className="w-full py-2.5 px-4 bg-transparent hover:bg-[#16181f] text-gray-400 hover:text-white border border-[#282b35] text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>Continue to Mobile Console</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
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
