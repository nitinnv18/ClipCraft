"use client";

import React from "react";
import {
  Sparkles,
  Layers,
  Smartphone,
  Scissors,
  Subtitles,
  Cloud,
  PlaySquare,
  History,
  CheckCircle2,
} from "lucide-react";

export const FeatureGrid: React.FC = () => {
  const features = [
    {
      icon: Sparkles,
      title: "AI Moment Detection",
      description:
        "Find hooks, insights, stories, useful answers and memorable moments automatically using deep transcript evaluation.",
      badge: "NLP Scoring",
    },
    {
      icon: Layers,
      title: "Multiple Clips",
      description:
        "Generate multiple clips from a single long-form video. Choose 3, 5, 7, or 10 distinct short segments in one batch.",
      badge: "Batch Generation",
    },
    {
      icon: Smartphone,
      title: "Vertical 9:16",
      description:
        "Create clips optimized for short-form platforms (TikTok, YouTube Shorts, Instagram Reels) with smart center crop.",
      badge: "1080x1920",
    },
    {
      icon: Scissors,
      title: "Smart Clip Boundaries",
      description:
        "Avoid awkward cuts and incomplete sentences. Our sentence-snapping algorithm aligns cut points to natural pauses.",
      badge: "±3.0s Snapping",
    },
    {
      icon: Subtitles,
      title: "Optional Captions",
      description:
        "Generate clean, readable high-contrast captions styled for maximum retention directly burned into the video.",
      badge: "Burned Subtitles",
    },
    {
      icon: Cloud,
      title: "Cloud Storage",
      description:
        "Keep generated clips available in your cloud history when storage is enabled, allowing instant access anytime.",
      badge: "Persistent Storage",
    },
    {
      icon: PlaySquare,
      title: "Fast Preview",
      description:
        "Review generated clips with full playback controls and subtitle toggles before downloading to save disk space.",
      badge: "Live Player",
    },
    {
      icon: History,
      title: "Clip History",
      description:
        "Access previous jobs, review past video transcripts, and re-download generated clips straight from your dashboard.",
      badge: "Job Archive",
    },
  ];

  return (
    <section id="features" className="w-full py-16 sm:py-24 bg-[#0a0b0d] border-b border-[#1f2229]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mb-12">
          <div className="text-[11px] font-mono uppercase tracking-widest text-amber-400 mb-2">
            SECTION 06 &bull; CORE CAPABILITIES
          </div>
          <h2 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-white mb-4">
            Engineered For Precision Short-Form Video
          </h2>
          <p className="text-xs sm:text-sm text-gray-400 leading-relaxed font-mono">
            Every feature is focused on turning raw video content into high-retention vertical clips without manual timeline editing.
          </p>
        </div>

        {/* Feature Grid: 4 columns on lg, 2 on md, 1 on mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="bg-[#121316] border border-[#272a30] p-5 flex flex-col justify-between hover:border-[#393d47] transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-9 h-9 bg-[#181a1f] border border-[#2d3039] flex items-center justify-center text-amber-400">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 bg-[#17191e] border border-[#272a31] text-gray-400">
                      {feature.badge}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-white uppercase tracking-tight mb-2">
                    {feature.title}
                  </h3>

                  <p className="text-xs text-gray-400 leading-relaxed font-sans mb-4">
                    {feature.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-[#1e2025] flex items-center gap-1.5 text-[10px] font-mono text-emerald-400">
                  <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                  <span>Production Ready</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
