"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Link2, Cpu, Video, Download } from "lucide-react";

export const HowItWorks: React.FC = () => {
  const steps = [
    {
      number: "01",
      icon: Link2,
      title: "Paste",
      description: "Add your YouTube video URL. The engine fetches transcript metadata and streams source details.",
      detail: "Supports long-form podcasts, interviews, lectures & webinars",
    },
    {
      number: "02",
      icon: Cpu,
      title: "Analyze",
      description: "AI analyzes the video transcript, detects engaging hooks, scores virality, and avoids dead air.",
      detail: "Sentence boundary snapping (±3.0s) ensures no cut-off words",
    },
    {
      number: "03",
      icon: Video,
      title: "Generate",
      description: "The system automatically creates multiple clips with 9:16 vertical crop and embedded subtitles.",
      detail: "FFmpeg headless rendering with 1080p vertical output",
    },
    {
      number: "04",
      icon: Download,
      title: "Download",
      description: "Preview your generated clips directly in the player and download individual files or the full batch.",
      detail: "MP4 standard delivery ready for TikTok, Shorts & Reels",
    },
  ];

  return (
    <section id="how-it-works" className="w-full py-16 sm:py-24 bg-[#0e0f12] border-b border-[#1f2229]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-widest text-amber-400 mb-2">
              SECTION 05 &bull; ARCHITECTURE & WORKFLOW
            </div>
            <h2 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-white">
              How It Works
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-gray-400 max-w-md font-mono">
            A 4-step autonomous pipeline converting raw long-form videos into publication-ready clips.
          </p>
        </div>

        {/* 4 Steps Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={step.number}
                className="bg-[#121316] border border-[#272a30] p-6 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-2xl font-mono font-black text-amber-400">
                      {step.number}
                    </span>
                    <div className="w-9 h-9 bg-[#191b20] border border-[#2e313a] flex items-center justify-center text-gray-300">
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-white uppercase tracking-tight mb-2 flex items-center gap-2">
                    <span>{step.title}</span>
                  </h3>

                  <p className="text-xs text-gray-400 leading-relaxed font-sans mb-4">
                    {step.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-[#1e2025] text-[10px] font-mono text-gray-400">
                  {step.detail}
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA Bar */}
        <div className="mt-10 p-5 bg-[#141518] border border-[#272a31] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs font-mono text-gray-300">
            <span className="text-white font-bold uppercase">Ready to test?</span> Try pasting a YouTube link without registration.
          </div>
          <Link href="/dashboard">
            <button className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-xs uppercase tracking-wider border border-amber-500 flex items-center gap-1.5 transition-colors">
              <span>Open Clipper</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
};
