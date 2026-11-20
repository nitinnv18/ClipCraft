"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { logger } from "@/lib/logger";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useVideoProcessing } from "@/context/VideoProcessingContext";
import {
  transcodeClipQuality,
  getVideoMetadata,
  ExportQuality,
  VideoMetadata,
  LayoutMode,
} from "@/lib/clientVideoProcessor";
import {
  Scissors,
  Settings2,
  Clock,
  ArrowRight,
  Zap,
  Download,
  CheckCircle2,
  RotateCcw,
  Film,
  ChevronDown,
  Loader2,
  Upload,
  Layers,
  Smartphone,
  Hd,
  Gamepad2,
} from "lucide-react";

function DashboardContent() {
  const router = useRouter();
  const { user } = useAuth();

  // Persistent Global Video Processing State
  const {
    selectedFile,
    setSelectedFile,
    clientClips,
    plannedClips,
    renderingClipIndex,
    activeClientClip,
    setActiveClientClip,
    clientProgress,
    isSubmitting,
    uploadStatusText,
    error,
    setError,
    previousSession,
    restorePreviousSession,
    abortProcessing,
    startClientProcessing,
    resetStudio,
  } = useVideoProcessing();

  // Form State
  const [isDragging, setIsDragging] = useState(false);
  const [clipCount, setClipCount] = useState(5);
  const [durationRange, setDurationRange] = useState<"15-30" | "30-60" | "60-90">("30-60");
  const [format, setFormat] = useState("9:16");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [detectedMeta, setDetectedMeta] = useState<VideoMetadata | null>(null);
  const [selectedQuality, setSelectedQuality] = useState<ExportQuality>("auto");
  const [isExportingQuality, setIsExportingQuality] = useState(false);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("split_gaming");

  // Auto-detect resolution and video quality when file is dropped or selected
  useEffect(() => {
    if (selectedFile) {
      getVideoMetadata(selectedFile)
        .then((meta) => {
          setDetectedMeta(meta);
        })
        .catch(() => {
          setDetectedMeta(null);
        });
    } else {
      setDetectedMeta(null);
    }
  }, [selectedFile]);

  const handleReset = resetStudio;

  const handleDownloadClip = async (targetQuality?: ExportQuality) => {
    if (!activeClientClip?.blobUrl) return;
    const q = targetQuality || selectedQuality;
    setIsExportingQuality(true);
    let finalUrl: string | null = null;
    try {
      finalUrl = await transcodeClipQuality(
        activeClientClip.blobUrl,
        q,
        activeClientClip.format || format
      );
      const qualityTag = q === "auto" ? (detectedMeta?.qualityLabel || "Original") : q;
      const a = document.createElement("a");
      a.href = finalUrl;
      a.download = `${activeClientClip.title.replace(/\s+/g, "_")}_${qualityTag}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      logger.error("Export quality conversion failed", e);
    } finally {
      if (finalUrl && finalUrl !== activeClientClip.blobUrl && finalUrl.startsWith("blob:")) {
        setTimeout(() => {
          try {
            URL.revokeObjectURL(finalUrl!);
          } catch (_) {}
        }, 1500);
      }
      setIsExportingQuality(false);
    }
  };

  // Set browser title
  useEffect(() => {
    document.title = "ClipCraft - Dashboard";
  }, []);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("video/") || /\.(mp4|mov|webm|mkv|avi)$/i.test(file.name)) {
        setSelectedFile(file);
        setError(null);
      } else {
        setError("Please drop a valid video file (.mp4, .mov, .webm).");
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedFile) {
      setError("Please select or drop a video file to upload.");
      return;
    }

    if (!user) {
      const redirectUrl = "/dashboard?tab=upload";
      router.push(`/login?redirect=${encodeURIComponent(redirectUrl)}`);
      return;
    }

    let minDur = 30;
    let maxDur = 60;
    if (durationRange === "15-30") {
      minDur = 15;
      maxDur = 30;
    } else if (durationRange === "60-90") {
      minDur = 60;
      maxDur = 90;
    }

    // Always run strictly On-Device (0 Server CPU Load, 0 Server Disk filling)
    const ok = await startClientProcessing(selectedFile, {
      clipCount,
      minDuration: minDur,
      maxDuration: maxDur,
      format,
      exportQuality: selectedQuality,
      layoutMode,
    });
    if (!ok && !error) {
      setError("Client processing was interrupted or failed to start.");
    }
  };

  return (
    <div className="w-full flex flex-col items-center gap-8 py-2 sm:py-6">
      {/* Page Header */}
      <div className="text-center flex flex-col gap-2 max-w-2xl">
        <div className="inline-flex items-center justify-center gap-2 text-xs font-mono font-semibold uppercase tracking-widest text-amber-500 bg-[#17191e] border border-[#272a31] py-1 px-3.5 mx-auto">
          <span>AI Clip Generation Engine</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold uppercase tracking-tight text-white">
          Create Viral Short Clips
        </h1>
        <p className="text-xs sm:text-sm text-gray-400 max-w-xl mx-auto">
          Drag and drop your raw video file. AI extracts high-retention viral moments and renders ready-to-publish 9:16 short clips directly on your device.
        </p>
      </div>

      {/* Main Container: Switches between Upload Form and Live Processing Studio */}
      {(isSubmitting || clientClips.length > 0) ? (
        /* Exact Match: Product Interface Preview Frame from Landing Page */
        <div className="w-full bg-[#0e0f12] border border-[#272a31] shadow-2xl">
          {/* Top Bar: Window Chrome */}
          <div className="h-10 bg-[#14161a] border-b border-[#24272e] px-4 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-[#2d3039] inline-block"></span>
                <span className="w-2.5 h-2.5 bg-[#2d3039] inline-block"></span>
                <span className="w-2.5 h-2.5 bg-[#2d3039] inline-block"></span>
              </div>
              <span className="text-gray-400 uppercase font-bold text-[11px] border-l border-[#24272e] pl-3">
                {isSubmitting ? "PROCESSING • ON-DEVICE HARDWARE" : "JOB #CLIENT-RENDER • COMPLETED"}
              </span>
            </div>
            <div className="flex items-center gap-4 text-gray-400 text-[11px]">
              <span className="hidden sm:inline">Source: {selectedFile?.name || "Uploaded video"}</span>
              <span className="text-emerald-400 flex items-center gap-1 font-mono">
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin inline-block mr-1" />
                    {clientClips.length} of {plannedClips.length || clipCount} Ready ({clientProgress}%)
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" /> {clientClips.length} Clips Ready
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Source Video Meta Header */}
          <div className="p-4 sm:p-5 bg-[#121316] border-b border-[#22252c] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-20 h-12 bg-[#1b1d22] border border-[#2b2e36] flex items-center justify-center flex-shrink-0 relative overflow-hidden">
                <Film className="w-5 h-5 text-gray-400" />
                <span className="absolute bottom-1 right-1 text-[9px] font-mono bg-black px-1 text-gray-300">
                  9:16
                </span>
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-white uppercase tracking-tight truncate max-w-md sm:max-w-xl">
                  {selectedFile?.name || "Uploaded Video"}
                </h3>
                <p className="text-xs text-gray-400 font-mono mt-0.5 truncate">
                  {uploadStatusText || (isSubmitting ? `Rendering clip ${(renderingClipIndex >= 0 ? renderingClipIndex + 1 : 1)} of ${plannedClips.length || clipCount}...` : `All ${clientClips.length} clips ready to publish • Format: 9:16 Vertical`)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="flex items-baseline gap-1 font-mono px-3 py-1 bg-[#181a1f] border border-[#2b2e36]">
                <span className="text-lg font-black text-amber-400">{clientProgress}</span>
                <span className="text-xs font-bold text-amber-500">%</span>
              </div>

              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono uppercase flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping inline-block" />
                    <span>Clipping In Progress</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Are you sure you want to abort the current video clipping?")) {
                        abortProcessing();
                      }
                    }}
                    className="px-2.5 py-1.5 bg-red-950/40 hover:bg-red-900/50 border border-red-800 text-red-300 text-xs font-mono uppercase transition-colors cursor-pointer"
                    title="Abort rendering"
                  >
                    Abort
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => handleReset(true)}
                  className="px-3.5 py-1.5 bg-[#181a1f] hover:bg-[#22252c] border border-[#30333d] text-gray-200 hover:text-white text-xs font-mono uppercase transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
                  <span>Clip Another Video</span>
                </button>
              )}
            </div>
          </div>

          {/* Progress Bar Track */}
          <div className="w-full bg-[#16181d] h-2 border-b border-[#252831] relative overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all duration-300 ease-out"
              style={{ width: `${Math.max(4, Math.min(100, clientProgress))}%` }}
            />
          </div>

          {/* Main Grid: Left: Detected Moments List (7 Cols), Right: Vertical 9:16 Video Player Preview (5 Cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* Left: Detected Moments List (7 Cols) */}
            <div className="lg:col-span-7 border-b lg:border-b-0 lg:border-r border-[#24272e] p-4 sm:p-6 bg-[#0f1013] flex flex-col gap-3">
              <div className="flex items-center justify-between mb-1 pb-2 border-b border-[#1c1e23]">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400 font-mono">
                  Detected Moments ({clientClips.length}/{plannedClips.length || clipCount})
                </span>
                <span className="text-[11px] font-mono text-gray-400">
                  Ranked by Viral Retention Score
                </span>
              </div>

              <div className="flex flex-col gap-2.5">
                {(plannedClips.length > 0
                  ? plannedClips
                  : Array.from({ length: clipCount }).map((_, i) => ({ id: `clip_${i + 1}`, title: `Viral Clip #${i + 1}`, hook: "Detecting highlight..." }))
                ).map((item, idx) => {
                  const renderedClip = clientClips.find((c) => c.id === item.id) || clientClips[idx];
                  const isRenderingThis = isSubmitting && renderingClipIndex === idx;
                  const isSelected = activeClientClip?.id === renderedClip?.id;

                  if (renderedClip) {
                    return (
                      <div
                        key={renderedClip.id || idx}
                        onClick={() => setActiveClientClip(renderedClip)}
                        className={`p-3.5 border transition-colors cursor-pointer text-left ${
                          isSelected
                            ? "bg-[#181a1f] border-amber-500 text-white"
                            : "bg-[#131417] border-[#252830] text-gray-300 hover:bg-[#16171b] hover:border-[#323640]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`text-xs font-mono font-bold ${isSelected ? "text-amber-400" : "text-gray-400"}`}>
                              0{idx + 1}
                            </span>
                            <span className="text-xs font-bold uppercase tracking-tight text-white truncate">
                              {Math.floor(renderedClip.start / 60)}:{String(Math.floor(renderedClip.start % 60)).padStart(2, "0")} — {renderedClip.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-[11px] font-mono px-1.5 py-0.5 bg-[#1f2127] text-gray-300 border border-[#2d3039]">
                              {Math.round(renderedClip.duration)}s
                            </span>
                            <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 bg-[#15231a] text-emerald-400 border border-emerald-800">
                              {renderedClip.score}% Match
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-gray-400 line-clamp-1 mb-2 font-mono">
                          &ldquo;{renderedClip.hook}&rdquo;
                        </p>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1c1e23] text-[10px] font-mono">
                          <div className="flex items-center gap-1.5 text-gray-400">
                            <span className="px-1.5 py-0.5 bg-[#0a0b0d] border border-[#22242a] text-emerald-400 font-bold">
                              READY ✓
                            </span>
                            <span className="px-1.5 py-0.5 bg-[#0a0b0d] border border-[#22242a]">
                              9:16 Vertical
                            </span>
                          </div>
                          <span className={`font-bold ${isSelected ? "text-amber-400" : "text-gray-400"}`}>
                            {isSelected ? "SELECTED • PREVIEWING" : "CLICK TO PREVIEW"}
                          </span>
                        </div>
                      </div>
                    );
                  }

                  if (isRenderingThis) {
                    return (
                      <div
                        key={item.id || idx}
                        className="relative p-3.5 bg-[#161820] border border-amber-500/30 text-left overflow-hidden"
                      >
                        {/* Only Border Pulses - Inner text remains completely solid & readable */}
                        <div className="absolute inset-0 border-2 border-amber-500 animate-pulse pointer-events-none" />

                        <div className="relative z-10">
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs font-mono font-bold text-amber-400">
                                0{idx + 1}
                              </span>
                              <span className="text-xs font-bold uppercase tracking-tight text-white truncate">
                                {item.title || `Clip #${idx + 1}`}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-[11px] font-mono font-bold px-2 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center gap-1.5">
                                <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
                                Rendering Now
                              </span>
                            </div>
                          </div>

                          <p className="text-xs text-gray-300 line-clamp-1 mb-2 font-mono">
                            &ldquo;{item.hook || "Cutting 9:16 vertical crop on local device..."}&rdquo;
                          </p>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#232731] text-[10px] font-mono">
                            <span className="text-gray-400">Hardware Acceleration Active</span>
                            <span className="font-bold text-amber-400">RENDERING IN PROGRESS...</span>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Queued / Pending State
                  return (
                    <div
                      key={item.id || idx}
                      className="p-3.5 border border-[#20222a] bg-[#0c0d10] opacity-50 text-left cursor-not-allowed"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-mono font-bold text-gray-500">
                            0{idx + 1}
                          </span>
                          <span className="text-xs font-bold uppercase tracking-tight text-gray-400 truncate">
                            {item.title || `Viral Moment #${idx + 1}`}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#14151a] text-gray-500 border border-[#242730]">
                          Queued
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 line-clamp-1 mb-2 font-mono">
                        &ldquo;{item.hook || "Waiting in render queue..."}&rdquo;
                      </p>
                      <div className="flex items-center justify-between pt-2 border-t border-[#181a20] text-[10px] font-mono text-gray-500">
                        <span>Position: #{idx + 1}</span>
                        <span>WAITING IN QUEUE</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Video Player Preview (5 Cols) */}
            {(() => {
              const activeFormat = activeClientClip?.format || format;
              const isSquare = activeFormat === "1:1";
              const isLandscape = activeFormat === "16:9";

              const frameContainerClass = isSquare
                ? "relative w-full max-w-[340px] sm:max-w-[360px] aspect-square bg-black border-2 border-[#2b2e36] overflow-hidden shadow-none transition-all duration-300"
                : isLandscape
                ? "relative w-full max-w-[440px] sm:max-w-[480px] aspect-video bg-black border-2 border-[#2b2e36] overflow-hidden shadow-none transition-all duration-300"
                : "relative w-full max-w-[280px] sm:max-w-[320px] md:max-w-[340px] aspect-[9/16] bg-black border-2 border-[#2b2e36] overflow-hidden shadow-none transition-all duration-300";

              const previewLabel = isSquare
                ? "Live 1:1 Square Preview"
                : isLandscape
                ? "Live 16:9 Landscape Preview"
                : "Live 9:16 Vertical Preview";

              const cropLabel = isSquare
                ? "Crop: Center 1:1 \u2022 1080x1080"
                : isLandscape
                ? "Crop: Center 16:9 \u2022 1920x1080"
                : "Crop: Center 9:16 \u2022 1080x1920";

              const actionButtonsClass = isSquare
                ? "w-full max-w-[340px] sm:max-w-[360px] mt-4 flex flex-col gap-2.5"
                : isLandscape
                ? "w-full max-w-[440px] sm:max-w-[480px] mt-4 flex flex-col gap-2.5"
                : "w-full max-w-[280px] sm:max-w-[320px] md:max-w-[340px] mt-4 flex flex-col gap-2.5";

              return (
                <div className="lg:col-span-5 p-4 sm:p-6 bg-[#0a0b0d] flex flex-col items-center justify-center">
                  <div className="text-[11px] font-mono text-gray-400 uppercase tracking-widest mb-3 self-start">
                    {previewLabel}
                  </div>

                  {/* Device / Video Frame */}
                  <div className={frameContainerClass}>
                    {activeClientClip?.blobUrl ? (
                      <video
                        key={activeClientClip.blobUrl}
                        src={activeClientClip.blobUrl}
                        controls
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full border border-[#20232b] flex flex-col justify-between p-4 bg-[#141518]">
                        <div className="text-[10px] font-mono text-gray-400 uppercase">
                          {cropLabel}
                        </div>
                        <div className="flex flex-col items-center gap-3">
                          <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                          <span className="text-xs font-mono text-gray-400 text-center">
                            {isSubmitting
                              ? "Rendering first clip... preview will play automatically"
                              : "Select a clip on the left to preview"}
                          </span>
                        </div>
                        <div className="text-center text-[10px] font-mono text-gray-600">
                          Ready to export
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons below preview */}
                  <div className={actionButtonsClass}>
                {/* Download Quality Selector Bar */}
                <div className="w-full p-2.5 bg-[#121316] border border-[#23262e] flex flex-col gap-2 text-xs font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-400 uppercase font-bold flex items-center gap-1.5">
                      <Hd className="w-3.5 h-3.5 text-amber-400" />
                      Download Quality:
                    </span>
                    <span className="text-[10px] text-amber-400/90 font-bold uppercase">
                      {selectedQuality === "auto"
                        ? `Auto: ${detectedMeta?.qualityLabel || "Original"}`
                        : selectedQuality}
                    </span>
                  </div>

                  {/* Multi-Quality Select Buttons */}
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-1">
                    {(["auto", "2160p", "1440p", "1080p", "720p", "480p", "360p", "240p"] as const).map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setSelectedQuality(q)}
                        className={`py-1.5 text-[10px] font-mono font-bold uppercase transition-colors cursor-pointer text-center ${
                          selectedQuality === q
                            ? "bg-amber-500 text-black border border-amber-500 font-black shadow-sm"
                            : "bg-[#181a1f] text-gray-400 border border-[#2b2e36] hover:text-white"
                        }`}
                        title={q === "auto" ? "Native source resolution without loss" : `Download as ${q}`}
                      >
                        {q === "auto" ? "Auto" : q}
                      </button>
                    ))}
                  </div>
                </div>

                {activeClientClip ? (
                  <button
                    type="button"
                    onClick={() => handleDownloadClip()}
                    disabled={isExportingQuality}
                    className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-xs uppercase tracking-wider border border-amber-500 flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
                  >
                    {isExportingQuality ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 text-black animate-spin" />
                        <span>Rendering {selectedQuality === "auto" ? (detectedMeta?.qualityLabel || "Original") : selectedQuality}...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        <span>Download ({selectedQuality === "auto" ? `Auto: ${detectedMeta?.qualityLabel || "Original"}` : selectedQuality} MP4)</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    disabled
                    className="w-full py-2.5 px-4 bg-[#1c1e24] text-gray-500 font-extrabold text-xs uppercase tracking-wider border border-[#2d3039] flex items-center justify-center gap-2 cursor-not-allowed"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Waiting for first clip...</span>
                  </button>
                )}

                {/* Viral Speech Hook Card */}
                <div className="w-full p-3 bg-[#121316] border border-[#23262e] text-xs font-mono flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300 font-bold flex items-center gap-1.5 uppercase text-[10px]">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      Viral Highlight Hook:
                    </span>
                    <span className="text-[10px] text-amber-400/90 bg-[#171920] px-1.5 py-0.5 border border-[#262832] font-mono uppercase">
                      AI Hook
                    </span>
                  </div>

                  <p className="text-[11px] text-gray-200 font-sans italic bg-[#0a0b0d] p-2 border border-[#1d1f25] leading-relaxed">
                    &ldquo;{activeClientClip?.hook || plannedClips[renderingClipIndex >= 0 ? renderingClipIndex : 0]?.hook || "High engagement viral moment"}&rdquo;
                  </p>

                  <div className="flex items-center justify-between text-[10px] text-gray-500 pt-0.5">
                    <span>Target: YouTube Shorts &bull; TikTok &bull; Reels</span>
                    <span className="text-amber-400/80">Score: {activeClientClip?.score || 95}%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-gray-400 pt-1">
                  <span>Video: H.264 MP4</span>
                  <span>Audio: Lossless Copy</span>
                </div>
              </div>
            </div>
          );
        })()}
          </div>
        </div>
      ) : (
        /* Main Clipper Upload Form Box */
        <div className="w-full max-w-4xl lg:max-w-5xl flex flex-col gap-4">
          {/* Previous Session Restore Banner */}
          {previousSession && (
            <div className="w-full bg-[#14161a] border border-amber-500/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[0_0_24px_rgba(245,158,11,0.08)]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0 text-amber-400">
                  <Film className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white uppercase font-mono">
                      Previous Clip Studio Active
                    </span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-mono px-2 py-0.5 border border-emerald-500/30 font-bold">
                      {previousSession.clientClips.length} CLIPS READY
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 font-mono mt-0.5 truncate max-w-sm sm:max-w-md">
                    {previousSession.fileName}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={restorePreviousSession}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase tracking-wider font-mono flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md flex-shrink-0"
              >
                <span>Return to Previous Clips</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="w-full">
          <div className="flex border-b border-[#2b2e36] bg-[#16181e] px-4 py-3.5 items-center justify-between">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400 font-mono">Direct Video Upload &amp; Fast Re-frame</span>
          </div>
          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 font-mono">
            On-Device
          </span>
        </div>

        <Card className="border-[#2b2e36] border-t-0 bg-[#121316] p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            {error && (
              <div className="p-3.5 bg-red-950 border border-red-600 text-red-200 text-xs font-mono">
                {error}
              </div>
            )}

            {/* Direct File Upload Dropzone */}
            <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-gray-200 uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Film className="w-3.5 h-3.5 text-amber-400" />
                    <span>Select or Drag Video File</span>
                  </span>
                  <span className="text-[11px] text-gray-400 font-normal font-mono">MP4, MOV, WEBM &bull; Up to 2 Hours</span>
                </label>

                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleFileDrop}
                  className={`border-2 border-dashed rounded-none p-6 text-center cursor-pointer transition-all ${
                    isDragging
                      ? "border-amber-400 bg-amber-950/20"
                      : selectedFile
                      ? "border-emerald-500/60 bg-emerald-950/10"
                      : "border-[#323640] bg-[#181a1f] hover:border-gray-500"
                  }`}
                  onClick={() => document.getElementById("file-upload-input")?.click()}
                >
                  <input
                    id="file-upload-input"
                    type="file"
                    accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        setSelectedFile(e.target.files[0]);
                        setError(null);
                      }
                    }}
                  />

                  {selectedFile ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                        <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                      </div>
                      <p className="text-sm font-bold text-white truncate max-w-md">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-gray-400 font-mono flex items-center justify-center gap-1.5 flex-wrap">
                        <span>{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                        <span>&bull;</span>
                        <span className="text-amber-400 font-semibold">
                          {detectedMeta ? `Detected: ${detectedMeta.width}x${detectedMeta.height} (${detectedMeta.readableQuality})` : "Detecting resolution..."}
                        </span>
                        <span>&bull;</span>
                        <span>Click or drag to replace</span>
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-[#252830] text-amber-400 flex items-center justify-center">
                        <Upload className="w-5 h-5 text-amber-400" />
                      </div>
                      <p className="text-xs sm:text-sm font-semibold text-gray-200">
                        Drag and drop your video file here, or <span className="text-amber-400 underline">browse</span>
                      </p>
                      <p className="text-[11px] text-gray-500 font-mono">
                        Supports high-quality MP4, MOV, WEBM files
                      </p>
                    </div>
                  )}
                </div>
              </div>

            {/* Quick Option Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Number of clips */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-amber-400" />
                  <span>Number of Clips</span>
                </label>
                <div className="relative w-full">
                  <select
                    value={clipCount}
                    onChange={(e) => setClipCount(Number(e.target.value))}
                    className="w-full appearance-none bg-[#181a1f] text-gray-100 border border-[#323640] pl-3 pr-7 py-2.5 text-xs font-semibold uppercase focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value={3}>3 Clips</option>
                    <option value={5}>5 Clips (Recommended)</option>
                    <option value={7}>7 Clips</option>
                    <option value={10}>10 Clips</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Clip duration */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Clip Duration</span>
                </label>
                <div className="relative w-full">
                  <select
                    value={durationRange}
                    onChange={(e) => setDurationRange(e.target.value as "15-30" | "30-60" | "60-90")}
                    className="w-full appearance-none bg-[#181a1f] text-gray-100 border border-[#323640] pl-3 pr-7 py-2.5 text-xs font-semibold uppercase focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="15-30">15 – 30 sec (Quick)</option>
                    <option value="30-60">30 – 60 sec (Optimal)</option>
                    <option value="60-90">60 – 90 sec (Extended)</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Format */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                  <span>Video Format</span>
                </label>
                <div className="relative w-full">
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                    className="w-full appearance-none bg-[#181a1f] text-gray-100 border border-[#323640] pl-3 pr-7 py-2.5 text-xs font-semibold uppercase focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="9:16">9:16 Vertical (Shorts/TikTok)</option>
                    <option value="1:1">1:1 Square (Feed)</option>
                    <option value="16:9">16:9 Landscape</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Video Quality */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Hd className="w-3.5 h-3.5 text-amber-400" />
                  <span>Export Quality</span>
                </label>
                <div className="relative w-full">
                  <select
                    value={selectedQuality}
                    onChange={(e) => setSelectedQuality(e.target.value as ExportQuality)}
                    className="w-full appearance-none bg-[#181a1f] text-gray-100 border border-[#323640] pl-3 pr-7 py-2.5 text-xs font-semibold uppercase focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="auto">
                      Auto Detect {detectedMeta ? `(${detectedMeta.qualityLabel} Source)` : "(Original Quality)"}
                    </option>
                    <option value="2160p">2160p (4K Ultra HD)</option>
                    <option value="1440p">1440p (2K Quad HD)</option>
                    <option value="1080p">1080p (Full HD)</option>
                    <option value="720p">720p (HD Ready)</option>
                    <option value="480p">480p (Standard / SD)</option>
                    <option value="360p">360p (Low / Mobile)</option>
                    <option value="240p">240p (Data Saver)</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Video Layout Mode: Standard Portrait vs Streamer/Gaming Split */}
            <div className="flex flex-col gap-3 p-3.5 bg-[#14161b] border border-[#272a33]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-semibold text-gray-200 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                  <Gamepad2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Video Layout Mode</span>
                  <span className="text-[10px] text-amber-400/90 bg-amber-400/10 px-1.5 py-0.5 border border-amber-400/20 font-bold">DEFAULT: GAMING FIT</span>
                </label>
                <span className="text-[11px] text-gray-400 font-mono">
                  {layoutMode === "split_gaming" ? "Gaming Fit (Center + Ambient Blur)" : "Standard Portrait (9:16 Center Crop)"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setLayoutMode("split_gaming")}
                  className={`p-3 border text-left flex items-start gap-2.5 transition-all ${
                    layoutMode === "split_gaming"
                      ? "bg-amber-500/10 border-amber-500 text-white"
                      : "bg-[#181a1f] border-[#2d303a] text-gray-400 hover:text-gray-200 hover:border-gray-600"
                  }`}
                >
                  <Gamepad2 className={`w-4 h-4 mt-0.5 shrink-0 ${layoutMode === "split_gaming" ? "text-amber-400" : "text-gray-500"}`} />
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <span>Gaming Fit (Center + Blur)</span>
                      <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.2 rounded font-mono font-semibold">DEFAULT</span>
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5 leading-snug">
                      Full 16:9 Game &amp; Facecam in center with ambient blurred top &amp; bottom.
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setLayoutMode("standard")}
                  className={`p-3 border text-left flex items-start gap-2.5 transition-all ${
                    layoutMode === "standard"
                      ? "bg-amber-500/10 border-amber-500 text-white"
                      : "bg-[#181a1f] border-[#2d303a] text-gray-400 hover:text-gray-200 hover:border-gray-600"
                  }`}
                >
                  <Smartphone className={`w-4 h-4 mt-0.5 shrink-0 ${layoutMode === "standard" ? "text-amber-400" : "text-gray-500"}`} />
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider">Standard Portrait (9:16)</div>
                    <div className="text-[11px] text-gray-400 mt-0.5 leading-snug">
                      Crop 9:16 center for talking heads, podcasts, education, interviews.
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Engine & Processing Options Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 py-3 border-y border-[#22252c]">
              <div className="flex items-center gap-3 text-xs font-mono text-gray-400">
                <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Hardware Acceleration Active
                </span>
                <span className="text-gray-600">&bull;</span>
                <span>Zero Server Uploads</span>
              </div>

              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs uppercase font-medium text-gray-400 hover:text-white flex items-center gap-1 font-mono cursor-pointer"
              >
                <Settings2 className="w-3.5 h-3.5" />
                {showAdvanced ? "Hide Advanced" : "Advanced"}
              </button>
            </div>

            {/* Advanced Settings Collapsible */}
            {showAdvanced && (
              <div className="p-4 bg-[#0d0e11] border border-[#23262d] flex flex-col gap-3 text-xs text-gray-400 font-mono">
                <div className="flex items-center justify-between">
                  <span>Deduplication & Overlap Threshold:</span>
                  <span className="text-gray-200 font-bold">25% Max Overlap</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Boundary Sentence Snapping:</span>
                  <span className="text-gray-200 font-bold">Active (&plusmn;3.0s)</span>
                </div>
              </div>
            )}

            {/* Engine Status Bar */}
            <div className="flex items-center justify-between p-3 bg-[#14161b] border border-[#272a33] text-xs font-mono">
              <span className="text-gray-300 font-bold flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Cutting Engine:
              </span>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 text-[11px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  Local FFmpeg WASM (Zero Server Upload)
                </span>
              </div>
            </div>

            {/* Real-time Percentage & Progress Box */}
            {isSubmitting && (
              <div className="p-4 bg-[#14161c] border border-amber-500/60 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Loader2 className="w-5 h-5 text-amber-500 animate-spin flex-shrink-0" />
                    <span className="text-xs font-bold text-gray-200 uppercase font-mono truncate">
                      {uploadStatusText || "Processing video..."}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1 font-mono flex-shrink-0 pl-2">
                    <span className="text-xl font-black text-amber-400">{clientProgress}</span>
                    <span className="text-xs font-bold text-amber-500">%</span>
                  </div>
                </div>

                {/* Visual Progress Bar Track */}
                <div className="w-full bg-[#16181d] h-2.5 border border-[#2b2e36] relative overflow-hidden">
                  <div
                    className="h-full bg-amber-500 transition-all duration-300 ease-out"
                    style={{ width: `${Math.max(4, Math.min(100, clientProgress))}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono">
                  <span>⚡ Browser Hardware Acceleration</span>
                  <span className="text-amber-400/80 font-bold">{clientProgress}% Complete</span>
                </div>
              </div>
            )}

            {/* Main CTA */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isSubmitting}
              loadingText={`PROCESSING... ${clientProgress}%`}
              className="w-full text-sm font-black py-4 flex items-center justify-center gap-2"
            >
              <Scissors className="w-4 h-4" />
              <span>Upload &amp; Generate Clips</span>
            </Button>
          </form>
        </Card>
        </div>
      </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs font-mono text-gray-400">Loading Dashboard...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
