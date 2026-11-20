"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Play,
  Pause,
  Download,
  Scissors,
  Volume2,
  VolumeX,
  CheckCircle2,
  Film,
} from "lucide-react";

interface MockClip {
  id: string;
  title: string;
  hook: string;
  startTime: string;
  duration: string;
  seconds: number;
  score: number;
  tags: string[];
  subtitles: string;
}

const MOCK_CLIPS: MockClip[] = [
  {
    id: "clip-1",
    title: "The key insight",
    hook: "The moment that changes how neural networks understand reasoning.",
    startTime: "01:42",
    duration: "00:38",
    seconds: 38,
    score: 98,
    tags: ["High Hook Score", "Complete Thought", "Snappy Conclusion"],
    subtitles: "The model doesn't just memorize tokens — it forms an internal world representation.",
  },
  {
    id: "clip-2",
    title: "The surprising answer",
    hook: "Why scaling compute alone isn't enough without architectural constraints.",
    startTime: "02:17",
    duration: "00:47",
    seconds: 47,
    score: 95,
    tags: ["Strong Punchline", "Key Statement"],
    subtitles: "Everyone thought compute was the bottleneck, but efficiency in context routing changes everything.",
  },
  {
    id: "clip-3",
    title: "The story everyone remembers",
    hook: "The real breakdown of what happened during the first production release.",
    startTime: "08:31",
    duration: "00:52",
    seconds: 52,
    score: 94,
    tags: ["Emotional Hook", "Story Arc"],
    subtitles: "At 3 AM on launch day, our cluster processed 10 million videos without a single drop.",
  },
  {
    id: "clip-4",
    title: "Why traditional video editing fails",
    hook: "Manual scrubbing through 2-hour podcasts takes hours of editing time.",
    startTime: "14:05",
    duration: "00:41",
    seconds: 41,
    score: 91,
    tags: ["Pain Point", "Actionable"],
    subtitles: "You spend 4 hours scrubbing timelines just to find 30 seconds of high value.",
  },
  {
    id: "clip-5",
    title: "The blueprint for automated short clips",
    hook: "How automated NLP sentence boundary detection beats naive cutting.",
    startTime: "22:50",
    duration: "00:55",
    seconds: 55,
    score: 89,
    tags: ["Technical Deep Dive", "Synthesis"],
    subtitles: "When you snap to natural punctuation boundaries, the viewer never feels an abrupt cut.",
  },
];

export const ProductPreview: React.FC = () => {
  const [activeClipId, setActiveClipId] = useState<string>("clip-1");
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showCaptions, setShowCaptions] = useState<boolean>(true);

  const activeClip = MOCK_CLIPS.find((c) => c.id === activeClipId) || MOCK_CLIPS[0];

  return (
    <section className="w-full py-16 sm:py-24 bg-[#0a0b0d] border-b border-[#1f2229]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-widest text-amber-400 mb-2">
              SECTION 03 &bull; REALISTIC WORKSPACE
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black uppercase tracking-tight text-white">
              Product Interface Preview
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-gray-400 max-w-md font-mono">
            Autonomous transcript semantic analysis paired with FFmpeg vertical 9:16 crop & subtitle rendering.
          </p>
        </div>

        {/* Dashboard Preview Frame */}
        <div className="bg-[#0e0f12] border border-[#272a31]">
          {/* Top Bar: Window Chrome */}
          <div className="h-10 bg-[#14161a] border-b border-[#24272e] px-4 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-[#2d3039] inline-block"></span>
                <span className="w-2.5 h-2.5 bg-[#2d3039] inline-block"></span>
                <span className="w-2.5 h-2.5 bg-[#2d3039] inline-block"></span>
              </div>
              <span className="text-gray-400 uppercase font-bold text-[11px] border-l border-[#24272e] pl-3">
                Job #CC-8492 &bull; COMPLETED
              </span>
            </div>
            <div className="flex items-center gap-4 text-gray-400 text-[11px]">
              <span className="hidden sm:inline">Source: keynote_presentation.mp4</span>
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> 5 Clips Ready
              </span>
            </div>
          </div>

          {/* Source Video Meta Header */}
          <div className="p-4 sm:p-5 bg-[#121316] border-b border-[#22252c] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-20 h-12 bg-[#1b1d22] border border-[#2b2e36] flex items-center justify-center flex-shrink-0 relative overflow-hidden">
                <Film className="w-5 h-5 text-gray-400" />
                <span className="absolute bottom-1 right-1 text-[9px] font-mono bg-black px-1 text-gray-300">
                  48:20
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-tight">
                  How Autonomous Neural Reasoning Works &bull; Tech Keynote 2026
                </h3>
                <p className="text-xs text-gray-400 font-mono mt-0.5">
                  Duration: 48m 20s &bull; Transcribed 7,820 words &bull; Format: 9:16 Vertical
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link href="/dashboard">
                <button className="px-3.5 py-1.5 bg-[#181a1f] hover:bg-[#22252c] border border-[#30333d] text-gray-200 hover:text-white text-xs font-mono uppercase transition-colors flex items-center gap-1.5">
                  <Scissors className="w-3.5 h-3.5 text-amber-500" />
                  <span>Clip Another Video</span>
                </button>
              </Link>
            </div>
          </div>

          {/* Main Grid: Left Clip List, Right Vertical 9:16 Video Player */}
          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* Left: Detected Moments List (7 Cols) */}
            <div className="lg:col-span-7 border-b lg:border-b-0 lg:border-r border-[#24272e] p-4 sm:p-6 bg-[#0f1013] flex flex-col gap-3">
              <div className="flex items-center justify-between mb-1 pb-2 border-b border-[#1c1e23]">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400 font-mono">
                  Detected Moments ({MOCK_CLIPS.length})
                </span>
                <span className="text-[11px] font-mono text-gray-400">
                  Ranked by Viral Retention Score
                </span>
              </div>

              <div className="flex flex-col gap-2.5">
                {MOCK_CLIPS.map((clip, idx) => {
                  const isActive = clip.id === activeClipId;
                  return (
                    <div
                      key={clip.id}
                      onClick={() => setActiveClipId(clip.id)}
                      className={`p-3.5 border transition-colors cursor-pointer text-left ${
                        isActive
                          ? "bg-[#181a1f] border-amber-500 text-white"
                          : "bg-[#131417] border-[#252830] text-gray-300 hover:bg-[#16171b] hover:border-[#323640]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-mono font-bold ${isActive ? "text-amber-400" : "text-gray-400"}`}>
                            0{idx + 1}
                          </span>
                          <span className="text-xs font-bold uppercase tracking-tight text-white truncate">
                            {clip.startTime} — {clip.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[11px] font-mono px-1.5 py-0.5 bg-[#1f2127] text-gray-300 border border-[#2d3039]">
                            {clip.duration}
                          </span>
                          <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 bg-[#15231a] text-emerald-400 border border-emerald-800">
                            {clip.score}% Match
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-gray-400 line-clamp-1 mb-2 font-mono">
                        &ldquo;{clip.hook}&rdquo;
                      </p>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1c1e23] text-[10px] font-mono">
                        <div className="flex items-center gap-1.5 text-gray-400">
                          {clip.tags.map((tag) => (
                            <span key={tag} className="px-1.5 py-0.5 bg-[#0a0b0d] border border-[#22242a]">
                              {tag}
                            </span>
                          ))}
                        </div>
                        <span className={`font-bold ${isActive ? "text-amber-400" : "text-gray-400"}`}>
                          {isActive ? "SELECTED &bull; PREVIEWING" : "CLICK TO PREVIEW"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Vertical 9:16 Video Player Preview (5 Cols) */}
            <div className="lg:col-span-5 p-4 sm:p-6 bg-[#0a0b0d] flex flex-col items-center justify-center">
              <div className="text-[11px] font-mono text-gray-400 uppercase tracking-widest mb-3 self-start">
                Live 9:16 Vertical Preview
              </div>

              {/* 9:16 Device / Video Frame */}
              <div className="relative w-full max-w-[260px] sm:max-w-[280px] aspect-[9/16] bg-[#121316] border-2 border-[#2b2e36] flex flex-col justify-between p-3 overflow-hidden shadow-none">
                {/* Top Video Header HUD */}
                <div className="flex items-center justify-between text-[10px] font-mono text-gray-300 z-10 bg-[#0a0b0d]/80 px-2 py-1 border border-[#26282f]">
                  <span className="text-amber-400 font-bold uppercase">{activeClip.title}</span>
                  <span>{activeClip.duration}</span>
                </div>

                {/* Simulated Animated Visual Waveform & Background */}
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-[#141518]">
                  {/* Subtle Grid Lines */}
                  <div className="w-full h-full border border-[#20232b] flex flex-col justify-between p-3">
                    <div className="text-[10px] font-mono text-gray-400 uppercase">
                      Crop: Center 9:16 &bull; 1080x1920
                    </div>

                    {/* Audio Waveform visualization */}
                    <div className="flex items-end justify-center gap-1 h-20 w-full px-2">
                      {[40, 65, 80, 45, 95, 70, 85, 30, 90, 60, 75, 50, 88, 42, 60, 92, 45, 70].map((h, i) => (
                        <div
                          key={i}
                          style={{ height: `${isPlaying ? h : 20}%` }}
                          className={`w-1.5 transition-all duration-300 ${
                            i % 2 === 0 ? "bg-amber-500" : "bg-[#383d47]"
                          }`}
                        />
                      ))}
                    </div>

                    {/* Styled High-Contrast Subtitles Preview */}
                    {showCaptions && (
                      <div className="bg-black border border-white/20 p-2.5 text-center text-xs font-extrabold text-white uppercase tracking-tight leading-tight">
                        <span className="text-amber-400">&ldquo;</span>
                        {activeClip.subtitles}
                        <span className="text-amber-400">&rdquo;</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Video Controls HUD */}
                <div className="flex items-center justify-between z-10 bg-[#0a0b0d]/90 p-2 border border-[#26282f] text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="p-1.5 bg-[#1f2127] hover:bg-[#2c2f38] text-white border border-[#353842]"
                      aria-label="Play/Pause"
                    >
                      {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => setIsMuted(!isMuted)}
                      className="p-1.5 bg-[#1f2127] hover:bg-[#2c2f38] text-gray-300 hover:text-white border border-[#353842]"
                      aria-label="Toggle Mute"
                    >
                      {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <button
                    onClick={() => setShowCaptions(!showCaptions)}
                    className={`px-2 py-1 text-[10px] font-mono uppercase font-bold border ${
                      showCaptions
                        ? "bg-amber-500 text-black border-amber-500"
                        : "bg-[#181a1f] text-gray-400 border-[#2f323a]"
                    }`}
                  >
                    CC {showCaptions ? "ON" : "OFF"}
                  </button>
                </div>
              </div>

              {/* Action Buttons below preview */}
              <div className="w-full max-w-[280px] mt-4 flex flex-col gap-2">
                <Link href="/dashboard" className="w-full">
                  <button className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-xs uppercase tracking-wider border border-amber-500 flex items-center justify-center gap-2 cursor-pointer transition-colors">
                    <Download className="w-3.5 h-3.5" />
                    <span>Download This Clip (MP4)</span>
                  </button>
                </Link>

                <div className="flex items-center justify-between text-[11px] font-mono text-gray-400 pt-1">
                  <span>Render: FFmpeg H.264</span>
                  <span>Audio: 320kbps AAC</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
