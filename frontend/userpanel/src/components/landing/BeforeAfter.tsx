"use client";

import React from "react";
import { Clock, Film, ArrowRight, Play, CheckCircle2, XCircle } from "lucide-react";

export const BeforeAfter: React.FC = () => {
  const shortClips = [
    { num: "01", duration: "42 sec", title: "The core breakthrough insight", format: "9:16 Vertical" },
    { num: "02", duration: "51 sec", title: "Why traditional systems break", format: "9:16 Vertical" },
    { num: "03", duration: "38 sec", title: "The surprising benchmark test", format: "9:16 Vertical" },
    { num: "04", duration: "47 sec", title: "Key takeaway for engineering teams", format: "9:16 Vertical" },
    { num: "05", duration: "55 sec", title: "The future prediction statement", format: "9:16 Vertical" },
  ];

  return (
    <section id="before-after" className="w-full py-16 sm:py-24 bg-[#0e0f12] border-b border-[#1f2229]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="text-[11px] font-mono uppercase tracking-widest text-amber-400 mb-2">
            SECTION 07 &bull; TRANSFORMATION
          </div>
          <h2 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-white mb-3">
            One long video. <br className="hidden sm:inline" />
            <span className="text-amber-500">Multiple moments</span> worth sharing.
          </h2>
          <p className="text-xs sm:text-sm text-gray-400 font-mono">
            Compare the friction of raw unedited footage against structured, high-velocity short clips.
          </p>
        </div>

        {/* Side by Side Comparison Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* LEFT: 1 Hour Video (5 Cols) */}
          <div className="lg:col-span-5 bg-[#121316] border border-[#272a30] p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 mb-6 border-b border-[#1e2025]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-rose-500 inline-block"></span>
                  <span className="text-xs font-mono uppercase tracking-wider text-gray-300 font-bold">
                    Input Source
                  </span>
                </div>
                <span className="text-xs font-mono text-gray-400">1 Raw File</span>
              </div>

              <div className="mb-6">
                <div className="text-2xl font-black uppercase tracking-tight text-white mb-1">
                  1 Hour Video
                </div>
                <p className="text-xs text-gray-400 font-mono">
                  60 minutes &bull; 1080p 16:9 Landscape &bull; Single continuous stream
                </p>
              </div>

              {/* Bulky timeline mock */}
              <div className="bg-[#181a1f] border border-[#2d3039] p-4 mb-6">
                <div className="flex items-center justify-between text-[11px] font-mono text-gray-400 mb-2">
                  <span>00:00:00</span>
                  <span className="text-amber-400">Scrubbing 3,600 seconds manually</span>
                  <span>01:00:00</span>
                </div>
                <div className="w-full h-8 bg-[#252830] border border-[#353945] flex items-center px-2">
                  <div className="w-full h-2 bg-[#3b404d] relative">
                    {/* Simulated scattered tiny insight needles in a haystack */}
                    <div className="absolute left-[12%] top-0 bottom-0 w-1 bg-amber-500" title="Hook at 07:12"></div>
                    <div className="absolute left-[34%] top-0 bottom-0 w-1 bg-amber-500" title="Hook at 20:24"></div>
                    <div className="absolute left-[62%] top-0 bottom-0 w-1 bg-amber-500" title="Hook at 37:12"></div>
                    <div className="absolute left-[85%] top-0 bottom-0 w-1 bg-amber-500" title="Hook at 51:00"></div>
                  </div>
                </div>
                <div className="text-[10px] font-mono text-gray-400 mt-2 text-center">
                  Valuable standalone moments buried across long pauses and filler.
                </div>
              </div>

              <div className="flex flex-col gap-2 text-xs text-gray-400 font-mono">
                <div className="flex items-center gap-2 text-rose-400">
                  <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Requires 3–4 hours of manual timeline scrubbing</span>
                </div>
                <div className="flex items-center gap-2 text-rose-400">
                  <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Not formatted for vertical mobile feeds (16:9)</span>
                </div>
                <div className="flex items-center gap-2 text-rose-400">
                  <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Zero subtitles or burned caption highlights</span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-[#1e2025] text-[11px] font-mono text-gray-400">
              Format: Standard 16:9 Landscape Video
            </div>
          </div>

          {/* MIDDLE: Transition Indicator (2 Cols on desktop) */}
          <div className="lg:col-span-2 flex flex-col items-center justify-center p-4 bg-[#141518] border border-[#272a30] text-center">
            <div className="w-10 h-10 bg-amber-500 text-black flex items-center justify-center font-bold mb-3">
              <ArrowRight className="w-5 h-5 hidden lg:block" />
              <Film className="w-5 h-5 lg:hidden" />
            </div>
            <div className="text-xs font-mono uppercase font-black text-white mb-1">
              ClipCraft AI
            </div>
            <div className="text-[11px] font-mono text-gray-400">
              Autonomous Parsing &amp; Precision Cuts
            </div>
          </div>

          {/* RIGHT: Multiple Short Clips (5 Cols) */}
          <div className="lg:col-span-5 bg-[#121316] border border-amber-500/80 p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 mb-6 border-b border-[#24272e]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-emerald-500 inline-block"></span>
                  <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-bold">
                    Extracted Output
                  </span>
                </div>
                <span className="text-xs font-mono text-amber-400 font-bold">5 Ready Clips</span>
              </div>

              <div className="mb-4">
                <div className="text-2xl font-black uppercase tracking-tight text-white mb-1">
                  Multiple Short Clips
                </div>
                <p className="text-xs text-gray-400 font-mono">
                  Autonomous 9:16 vertical crop with styled high-contrast subtitles
                </p>
              </div>

              {/* Clip list */}
              <div className="flex flex-col gap-2 mb-6">
                {shortClips.map((clip) => (
                  <div
                    key={clip.num}
                    className="p-2.5 bg-[#17191e] border border-[#2c2f38] flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="font-mono text-amber-400 font-bold text-xs">{clip.num}</span>
                      <span className="font-bold text-white uppercase truncate text-[11px]">
                        {clip.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="px-1.5 py-0.5 bg-[#20232a] text-gray-300 font-mono text-[10px] border border-[#2e323c]">
                        {clip.duration}
                      </span>
                      <span className="px-1.5 py-0.5 bg-[#122319] text-emerald-400 font-mono text-[10px] border border-emerald-900">
                        {clip.format}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-2 text-xs text-gray-400 font-mono">
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Ready to post to TikTok, Shorts &amp; Reels instantly</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Complete thoughts with natural sentence boundaries</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>5x the content distribution from 1 single production</span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-[#1e2025] text-[11px] font-mono text-gray-400">
              Format: 1080x1920 Vertical MP4
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
