"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Scissors, UploadCloud, Film, Bot } from "lucide-react";
import { useVideoProcessing } from "@/context/VideoProcessingContext";

export const DemoInput: React.FC = () => {
  const router = useRouter();
  const { setSelectedFile } = useVideoProcessing();
  const [isDragging, setIsDragging] = useState(false);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("video/") || /\.(mp4|mov|webm|mkv|avi)$/i.test(file.name)) {
        setSelectedFile(file);
      }
    }
    router.push("/dashboard?tab=upload");
  };

  return (
    <div className="w-full max-w-2xl mx-auto overflow-hidden">
      {/* Container Box */}
      <div className="bg-[#121316] border border-[#272a30] p-4 sm:p-5">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <label
              className="text-[11px] font-mono uppercase tracking-widest text-gray-400 flex items-center gap-1.5 truncate"
            >
              <UploadCloud className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span className="truncate">Select or drop video file (MP4 / MOV / WEBM)</span>
            </label>
            <span className="text-[10px] font-mono text-emerald-400 whitespace-nowrap flex-shrink-0">
              ⚡ Instant On-Device
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
              className={`relative flex-1 min-w-0 bg-[#181a1f] border px-3.5 py-2.5 text-xs sm:text-sm font-mono cursor-pointer transition-colors flex items-center justify-between gap-2 ${isDragging
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
            <span className="flex items-center gap-1.5 text-emerald-400 text-[10px] sm:text-[11px]">
              <Bot className="w-3.5 h-3.5" />
              <span>Instant AI Processing</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};


