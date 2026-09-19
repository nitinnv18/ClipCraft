"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Scissors, Play, UploadCloud, Film, Sparkles } from "lucide-react";

const SAMPLE_VIDEOS = [
  {
    label: "Tech Keynote",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    duration: "48m",
  },
  {
    label: "Podcast Interview",
    url: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
    duration: "1h 14m",
  },
  {
    label: "Founder Talk",
    url: "https://www.youtube.com/watch?v=9bZkp7q19f0",
    duration: "32m",
  },
];

export const DemoInput: React.FC = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"upload" | "youtube">("upload");
  const [url, setUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const handleGenerateYoutube = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    router.push(`/dashboard?url=${encodeURIComponent(url.trim())}`);
  };

  const handleSelectSample = (sampleUrl: string) => {
    setUrl(sampleUrl);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    router.push("/dashboard?tab=upload");
  };

  return (
    <div className="w-full max-w-2xl mx-auto overflow-hidden">
      {/* Top Tabs */}
      <div className="grid grid-cols-2 border-b border-[#272a30] bg-[#0d0e11]">
        <button
          type="button"
          onClick={() => setActiveTab("upload")}
          className={`py-3 px-2 sm:px-4 text-[11px] sm:text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 sm:gap-2 border-b-2 transition-all cursor-pointer min-w-0 ${
            activeTab === "upload"
              ? "border-amber-500 text-amber-400 bg-[#14161b]"
              : "border-transparent text-gray-400 hover:text-gray-200 hover:bg-[#101216]"
          }`}
        >
          <UploadCloud className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span className="truncate">Upload File (MP4/MOV)</span>
          <span className="hidden md:inline-flex text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/40 px-1.5 py-0.5 rounded font-mono font-normal flex-shrink-0">
            Recommended
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("youtube")}
          className={`py-3 px-2 sm:px-4 text-[11px] sm:text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 sm:gap-2 border-b-2 transition-all cursor-pointer min-w-0 ${
            activeTab === "youtube"
              ? "border-amber-500 text-amber-400 bg-[#14161b]"
              : "border-transparent text-gray-400 hover:text-gray-200 hover:bg-[#101216]"
          }`}
        >
          <svg className="w-4 h-4 text-red-500 fill-current flex-shrink-0" viewBox="0 0 24 24">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
          </svg>
          <span className="truncate">YouTube URL</span>
        </button>
      </div>

      {/* Container Box */}
      <div className="bg-[#121316] border border-[#272a30] border-t-0 p-4 sm:p-5">
        {activeTab === "upload" ? (
          /* TAB 1: UPLOAD FILE */
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <label
                className="text-[11px] font-mono uppercase tracking-widest text-gray-400 flex items-center gap-1.5 truncate"
              >
                <UploadCloud className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <span className="truncate">Select or drop video file (MP4 / MOV / WEBM)</span>
              </label>
              <span className="text-[10px] font-mono text-emerald-400 whitespace-nowrap flex-shrink-0">
                Up to 2 Hours &bull; 100% Direct
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch gap-2">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileDrop}
                onClick={() => router.push("/dashboard?tab=upload")}
                className={`relative flex-1 min-w-0 bg-[#181a1f] border px-3.5 py-2.5 text-xs sm:text-sm font-mono cursor-pointer transition-colors flex items-center justify-between gap-2 ${
                  isDragging
                    ? "border-amber-400 bg-amber-950/20 text-amber-200"
                    : "border-[#323640] hover:border-amber-500/70 text-gray-300"
                }`}
              >
                <div className="flex items-center gap-2 truncate min-w-0">
                  <Film className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span className="truncate">Click to browse or drop video file</span>
                </div>
                <span className="text-[10px] uppercase font-bold text-amber-400 bg-[#242731] px-2 py-0.5 border border-[#373c4a] flex-shrink-0 hidden md:inline">
                  Browse
                </span>
              </div>

              <button
                type="button"
                onClick={() => router.push("/dashboard?tab=upload")}
                className="w-full sm:w-auto px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-xs uppercase tracking-wider border border-amber-500 flex items-center justify-center gap-2 cursor-pointer transition-colors whitespace-nowrap flex-shrink-0"
              >
                <Scissors className="w-3.5 h-3.5" />
                <span>Upload & Clip</span>
              </button>
            </div>

            {/* Bottom Formats & Features Line */}
            <div className="mt-1 pt-2.5 border-t border-[#1e2025] flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
              <div className="flex items-center gap-1.5 sm:gap-2 text-gray-400">
                <span className="text-[10px] uppercase text-gray-400">Supported:</span>
                <span className="px-1.5 py-0.5 bg-[#17191e] border border-[#272a31] text-gray-300 text-[10px]">MP4</span>
                <span className="px-1.5 py-0.5 bg-[#17191e] border border-[#272a31] text-gray-300 text-[10px]">MOV</span>
                <span className="px-1.5 py-0.5 bg-[#17191e] border border-[#272a31] text-gray-300 text-[10px]">WEBM</span>
              </div>
              <span className="flex items-center gap-1 text-emerald-400 text-[10px] sm:text-[11px]">
                <Sparkles className="w-3 h-3" />
                <span>Instant AI Transcription</span>
              </span>
            </div>
          </div>
        ) : (
          /* TAB 2: YOUTUBE URL */
          <form onSubmit={handleGenerateYoutube} className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="hero-demo-url"
                className="text-[11px] font-mono uppercase tracking-widest text-gray-400 flex items-center gap-1.5 truncate"
              >
                <svg className="w-3.5 h-3.5 text-red-500 fill-current flex-shrink-0" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
                <span className="truncate">Paste your YouTube video URL</span>
              </label>
              <span className="text-[10px] font-mono text-gray-400 whitespace-nowrap flex-shrink-0">
                9:16 Auto-Framing
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch gap-2">
              <div className="relative flex-1 min-w-0">
                <input
                  id="hero-demo-url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  className="w-full bg-[#181a1f] text-gray-100 placeholder-gray-400 border border-[#323640] px-3.5 py-2.5 text-xs sm:text-sm font-mono focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
                />
              </div>
              <button
                type="submit"
                className="w-full sm:w-auto px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-xs uppercase tracking-wider border border-amber-500 flex items-center justify-center gap-2 cursor-pointer transition-colors whitespace-nowrap flex-shrink-0"
              >
                <Scissors className="w-3.5 h-3.5" />
                <span>Generate Clips</span>
              </button>
            </div>

            {/* Sample Chips */}
            <div className="mt-1 pt-2.5 border-t border-[#1e2025] flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-mono text-gray-400 uppercase">Try sample:</span>
              {SAMPLE_VIDEOS.map((sample) => (
                <button
                  key={sample.label}
                  type="button"
                  onClick={() => handleSelectSample(sample.url)}
                  className="text-[11px] font-mono px-2 py-0.5 bg-[#17191e] hover:bg-[#20232a] text-gray-300 hover:text-amber-400 border border-[#272a31] transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Play className="w-2.5 h-2.5 fill-current text-gray-400" />
                  <span>{sample.label}</span>
                  <span className="text-gray-400">({sample.duration})</span>
                </button>
              ))}
            </div>
          </form>
        )}
      </div>
    </div>
  );
};


