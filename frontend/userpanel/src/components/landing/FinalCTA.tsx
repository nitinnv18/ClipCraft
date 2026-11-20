
import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Scissors, ArrowRight, LayoutDashboard } from "lucide-react";

export const FinalCTA: React.FC = () => {
  return (
    <section className="w-full py-16 sm:py-24 bg-[#0e0f12] border-b border-[#1f2229]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Container Box */}
        <div className="bg-[#121316] border border-[#272a30] p-8 sm:p-14 flex flex-col items-center">
          <div className="w-12 h-12 bg-amber-500 text-black flex items-center justify-center font-bold mb-6">
            <Scissors className="w-6 h-6 stroke-[2.5]" />
          </div>

          <h2 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-white mb-4 max-w-2xl leading-tight">
            Your next short clip might already be inside your long video.
          </h2>

          <p className="text-xs sm:text-base text-gray-400 max-w-xl mb-8 leading-relaxed font-sans">
            Give your long-form content a second life. Find the moments worth sharing automatically without manual timeline editing.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto justify-center">
            <Link href="/dashboard" className="w-full sm:w-auto">
              <Button
                variant="primary"
                size="lg"
                className="w-full sm:w-auto text-xs font-black tracking-wider py-4 px-8 flex items-center justify-center gap-2"
              >
                <span>Start Creating</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>

            <Link href="/dashboard" className="w-full sm:w-auto">
              <Button
                variant="secondary"
                size="lg"
                className="w-full sm:w-auto text-xs font-bold tracking-wider py-4 px-6 text-gray-200 border-[#2f323c] flex items-center justify-center gap-2"
              >
                <LayoutDashboard className="w-4 h-4 text-gray-400" />
                <span>View Dashboard</span>
              </Button>
            </Link>
          </div>

          <div className="mt-8 pt-6 border-t border-[#1e2025] flex flex-wrap items-center justify-center gap-6 text-[11px] font-mono text-gray-400 uppercase">
            <span>No Complex Setup Required</span>
            <span>&bull;</span>
            <span>Fast Turnaround</span>
            <span>&bull;</span>
            <span>Standard 1080p MP4</span>
          </div>
        </div>
      </div>
    </section>
  );
};
