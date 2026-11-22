"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";
import { VideoJob } from "@/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { getMediaUrl, formatSeconds } from "@/lib/utils";
import {
  Scissors,
  ArrowLeft,
  RefreshCw,
  Copy,
  Check,
  Download,
  Sparkles,
  Film,
  AlertTriangle,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Layers,
} from "lucide-react";

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();

  const [job, setJob] = useState<VideoJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Active clip state for the interactive 9:16 player
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showCaptions, setShowCaptions] = useState<boolean>(true);
  const [copied, setCopied] = useState(false);
  const [videoPlayFailed, setVideoPlayFailed] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    setVideoPlayFailed(false);
  }, [activeClipId]);

  useEffect(() => {
    document.title = "ClipCraft - Job Details";
  }, []);

  const fetchJob = useCallback(async () => {
    if (!params?.id) return;
    try {
      const data = await api.getJob(params.id);
      setJob((prev) => {
        if (!prev) return data;
        if (
          prev.status === data.status &&
          prev.progress === data.progress &&
          prev.stage === data.stage &&
          prev.clips?.length === data.clips?.length
        ) {
          return prev;
        }
        return data;
      });
      setError(null);
      if (data.clips && data.clips.length > 0) {
        const firstClipId = data.clips[0].id;
        setActiveClipId((curr) => curr || firstClipId);
      }
    } catch (err: unknown) {
      logger.warn("Job polling transient notice:", err);
      // Only set fatal error if job details were never loaded
      setJob((curr) => {
        if (!curr) {
          setError(err instanceof Error ? err.message : "Failed to load job details.");
        }
        return curr;
      });
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [params?.id]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await fetchJob();
  };

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  // Auto poll while job is active with visibility awareness
  const isJobActive = Boolean(
    job && [
      "queued",
      "processing",
      "fetching",
      "transcribing",
      "analyzing",
      "rendering",
      "uploading",
      "finalizing",
    ].includes(job.status)
  );

  useEffect(() => {
    if (!isJobActive) return;

    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      fetchJob();
    }, 3000);

    const handleVisibilityChange = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        fetchJob();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isJobActive, fetchJob]);

  useEffect(() => {
    if (job?.clips && job.clips.length > 0 && !activeClipId) {
      setActiveClipId(job.clips[0].id);
    }
  }, [job, activeClipId]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) {
    return (
      <div className="w-full max-w-5xl mx-auto py-20 text-center text-xs font-mono text-gray-400">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-amber-500" />
        <span>Loading video job details...</span>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="w-full max-w-xl mx-auto py-16 text-center">
        <Card className="p-8 border-red-800 bg-[#181113] text-red-200">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-3" />
          <h2 className="text-sm font-bold uppercase font-mono mb-2">Job Error</h2>
          <p className="text-xs font-mono text-gray-300 mb-6">{error || "The requested job was not found."}</p>
          <Link href="/dashboard">
            <Button variant="primary" size="md">
              Return to Dashboard
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  const clips = job.clips ?? [];
  const activeClip = clips.find((c) => c.id === activeClipId) || clips[0];
  const isProcessing = [
    "queued",
    "processing",
    "fetching",
    "transcribing",
    "analyzing",
    "rendering",
    "uploading",
    "finalizing",
  ].includes(job.status);

  const activeMediaUrl = activeClip ? getMediaUrl(activeClip.videoUrl) : "";

  return (
    <div className="w-full max-w-7xl mx-auto py-6 px-4 sm:px-6 flex flex-col gap-6">
      {/* Top Bar: Back Link & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#22252c]">
        <Link
          href="/history"
          className="text-xs uppercase font-mono font-bold text-gray-400 hover:text-amber-400 flex items-center gap-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Job History</span>
        </Link>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            isLoading={isRefreshing}
            className="text-xs font-mono px-3.5 py-2 font-semibold text-gray-300 hover:text-white border-[#323640] hover:border-gray-500 flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-amber-400" : "text-gray-400"}`} />
            <span>Refresh</span>
          </Button>

          <Link href="/dashboard">
            <Button variant="primary" size="sm" className="font-bold flex items-center gap-2 px-4 py-2">
              <Scissors className="w-3.5 h-3.5" />
              <span>New Job</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Video Summary Header Card */}
      <div className="p-4 sm:p-5 bg-[#121316] border border-[#272a31] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="w-20 h-12 bg-[#1b1d22] border border-[#2b2e36] flex items-center justify-center flex-shrink-0 relative overflow-hidden">
            {job.thumbnail ? (
              <Image src={getMediaUrl(job.thumbnail)} alt={job.title || "Job thumbnail"} fill className="object-cover" unoptimized />
            ) : (
              <Film className="w-5 h-5 text-gray-400" />
            )}
            {job.duration ? (
              <span className="absolute bottom-1 right-1 text-[9px] font-mono bg-black/90 px-1 text-gray-300">
                {formatSeconds(job.duration)}
              </span>
            ) : null}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant={job.status}>{job.status}</Badge>
              <span className="text-[10px] font-mono text-gray-400 uppercase">
                {clips.length} / {job.clipCount} Clips Generated
              </span>
            </div>
            <h1 className="text-sm sm:text-base font-bold text-white uppercase tracking-tight truncate">
              {job.title || "YouTube Video Clipping Job"}
            </h1>
            <p className="text-xs text-gray-400 font-mono mt-0.5 truncate">
              {job.youtubeUrl}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono text-gray-400 border-t md:border-t-0 md:border-l border-[#24272e] pt-3 md:pt-0 md:pl-5">
          <div>
            <span className="text-[10px] text-gray-500 uppercase block">Format</span>
            <span className="text-gray-200 font-bold">{job.settings?.format || "9:16 Vertical"}</span>
          </div>
          <div>
            <span className="text-[10px] text-gray-500 uppercase block">Engine</span>
            <span className="text-amber-400 font-bold">Local WASM</span>
          </div>
        </div>
      </div>

      {/* Live Progress Bar for Active / Rendering Jobs */}
      {isProcessing && (
        <div className="p-4 bg-[#14161a] border border-amber-500/40 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-amber-400 uppercase font-bold flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Active Pipeline &bull; Stage: {job.stage || "processing"}
            </span>
            <span className="text-white font-bold">{job.progress}% Complete</span>
          </div>
          <div className="w-full h-2 bg-[#1f2229] overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all duration-300"
              style={{ width: `${Math.max(job.progress, 5)}%` }}
            />
          </div>
        </div>
      )}

      {/* Error Alert if Failed */}
      {job.status === "failed" && (
        <div className="p-4 bg-red-950/80 border border-red-700 text-red-200 text-xs font-mono">
          <strong>Processing Notice:</strong> {job.error || "The background rendering pipeline encountered an error."}
        </div>
      )}

      {/* Main 2-Column Split: Left Moments List, Right 9:16 Live Player */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Detected Moments List (7 Cols) */}
        <div className="lg:col-span-7 bg-[#121316] border border-[#272a31] p-4 sm:p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between pb-3 border-b border-[#22252c]">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-300 font-mono flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-500" />
              <span>Detected Moments ({clips.length})</span>
            </span>
            <span className="text-[11px] font-mono text-gray-400">
              Ranked by Retention Score
            </span>
          </div>

          {clips.length === 0 ? (
            <div className="py-16 text-center text-xs font-mono text-gray-400 flex flex-col items-center gap-3">
              <Film className="w-8 h-8 text-gray-600" />
              <span>
                {isProcessing
                  ? "AI is analyzing speech transcripts and rendering 9:16 video cuts. Moments will populate automatically..."
                  : "No moments were extracted for this job."}
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {clips.map((clip, idx) => {
                const isActive = clip.id === activeClip?.id;
                const rawScore = clip.score ?? 85;
                const scoreVal = rawScore <= 1 ? Math.round(rawScore * 100) : Math.round(rawScore);

                return (
                  <div
                    key={clip.id}
                    onClick={() => {
                      setActiveClipId(clip.id);
                      setIsPlaying(true);
                    }}
                    className={`p-4 border transition-all cursor-pointer text-left ${
                      isActive
                        ? "bg-[#181a1f] border-amber-500 text-white"
                        : "bg-[#141518] border-[#252830] text-gray-300 hover:bg-[#181a1e] hover:border-[#383d47]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2.5 overflow-hidden flex-1 min-w-0">
                        <span
                          className={`text-xs font-mono font-bold px-1.5 py-0.5 border ${
                            isActive
                              ? "bg-amber-500 text-black border-amber-500"
                              : "bg-[#1c1e24] text-gray-400 border-[#2d3039]"
                          }`}
                        >
                          0{idx + 1}
                        </span>
                        <span className="text-xs font-bold uppercase tracking-tight text-white truncate">
                          {formatSeconds(clip.startTime)} &bull; {clip.title || `Clip #${idx + 1}`}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[11px] font-mono px-2 py-0.5 bg-[#1f2127] text-gray-300 border border-[#2d3039]">
                          {Math.round(clip.duration)}s
                        </span>
                        <span className="text-[11px] font-mono font-bold px-2 py-0.5 bg-[#15231a] text-emerald-400 border border-emerald-800 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-emerald-400" />
                          {scoreVal}% Match
                        </span>
                      </div>
                    </div>

                    {clip.hook ? (
                      <p className="text-xs text-gray-300 line-clamp-2 mb-3 font-mono leading-relaxed">
                        &ldquo;{clip.hook}&rdquo;
                      </p>
                    ) : null}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-[#1e2128] text-[10px] font-mono">
                      <div className="flex items-center gap-2 text-gray-400">
                        <span className="px-1.5 py-0.5 bg-[#0a0b0d] border border-[#22242a]">
                          {clip.aspectRatio || "9:16 Vertical"}
                        </span>
                        <span className="px-1.5 py-0.5 bg-[#0a0b0d] border border-[#22242a]">
                          {formatSeconds(clip.startTime)} &rarr; {formatSeconds(clip.endTime)}
                        </span>
                      </div>

                      <span
                        className={`font-bold flex items-center gap-1 ${
                          isActive ? "text-amber-400" : "text-gray-400"
                        }`}
                      >
                        {isActive ? "SELECTED &bull; PREVIEWING" : "CLICK TO PREVIEW"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Live 9:16 Vertical Video Player (5 Cols) - Sticky on Desktop */}
        <div className="lg:col-span-5 bg-[#121316] border border-[#272a31] p-4 sm:p-5 flex flex-col items-center justify-center lg:sticky lg:top-24">
          <div className="w-full flex items-center justify-between text-[11px] font-mono text-gray-400 uppercase tracking-widest mb-3">
            <span>Live 9:16 Vertical Preview</span>
            {activeClip ? (
              <span className="text-amber-400 font-bold">
                {(() => {
                  const rawScore = activeClip.score ?? 85;
                  return rawScore <= 1 ? Math.round(rawScore * 100) : Math.round(rawScore);
                })()}% Score
              </span>
            ) : null}
          </div>

          {/* Video Player Frame */}
          {(() => {
            const clipFormat = activeClip?.aspectRatio || job?.settings?.format || "9:16";
            const isSquare = clipFormat.includes("1:1");
            const isLandscape = clipFormat.includes("16:9");
            const frameClass = isSquare
              ? "relative w-full max-w-[340px] sm:max-w-[360px] aspect-square bg-black border border-[#2b2e36] flex flex-col justify-between p-3 overflow-hidden transition-all duration-300"
              : isLandscape
              ? "relative w-full max-w-[440px] sm:max-w-[480px] aspect-video bg-black border border-[#2b2e36] flex flex-col justify-between p-3 overflow-hidden transition-all duration-300"
              : "relative w-full max-w-[280px] sm:max-w-[300px] aspect-[9/16] bg-black border border-[#2b2e36] flex flex-col justify-between p-3 overflow-hidden transition-all duration-300";

            return (
              <div className={frameClass}>
                {/* Top HUD */}
                <div className="flex items-center justify-between text-[10px] font-mono text-gray-300 z-20 bg-[#0a0b0d]/90 px-2.5 py-1.5 border border-[#26282f]">
                  <span className="text-amber-400 font-bold uppercase truncate max-w-[170px]">
                    {activeClip?.title || "Video Clip"}
                  </span>
                  <span>{activeClip ? `${Math.round(activeClip.duration)}s` : "00:00"}</span>
                </div>

                {/* Video Element / Visual Center */}
                <div className="absolute inset-0 flex items-center justify-center bg-black overflow-hidden">
                  {videoPlayFailed && activeClip?.videoUrl?.startsWith("blob:") ? (
                    <div className="flex flex-col items-center gap-2.5 p-4 text-center text-gray-400 font-mono text-xs max-w-xs">
                      <AlertTriangle className="w-6 h-6 text-amber-400" />
                      <span className="font-bold text-gray-200 uppercase text-[11px]">Local Session Expired</span>
                      <span className="text-[10px] text-gray-400 leading-relaxed font-sans">
                        On-device clips are stored in browser memory during that active session. Re-clip from the dashboard to regenerate and download.
                      </span>
                      <Link href="/dashboard" className="mt-1 px-3 py-1 bg-amber-500 hover:bg-amber-600 text-black font-mono font-bold text-[10px] uppercase transition-colors">
                        Open Studio
                      </Link>
                    </div>
                  ) : activeMediaUrl ? (
                    <video
                      ref={videoRef}
                      key={activeMediaUrl}
                      src={activeMediaUrl}
                      poster={activeClip?.thumbnailUrl ? getMediaUrl(activeClip.thumbnailUrl) : undefined}
                      playsInline
                      autoPlay
                      controls={false}
                      className="w-full h-full object-contain"
                      onPlay={() => { setIsPlaying(true); setVideoPlayFailed(false); }}
                      onPause={() => setIsPlaying(false)}
                      onError={() => setVideoPlayFailed(true)}
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-3 p-4 text-center text-gray-500 font-mono text-xs">
                      <Film className="w-8 h-8 text-amber-500 animate-pulse" />
                      <span>Video Clip Rendering...</span>
                    </div>
                  )}

                  {/* Subtitles Overlay if toggled */}
                  {showCaptions && activeClip?.hook && (
                    <div className="absolute bottom-14 inset-x-3 z-10 pointer-events-none">
                      <div className="bg-black/85 border border-white/20 p-2.5 text-center text-xs font-extrabold text-white uppercase tracking-tight leading-tight shadow-2xl backdrop-blur-sm">
                        <span className="text-amber-400">&ldquo;</span>
                        {activeClip.hook}
                        <span className="text-amber-400">&rdquo;</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Video Controls HUD */}
                <div className="flex items-center justify-between z-20 bg-[#0a0b0d]/90 p-2 border border-[#26282f] text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={togglePlay}
                      className="p-1.5 bg-[#1f2127] hover:bg-[#2c2f38] text-white border border-[#353842] cursor-pointer"
                      aria-label="Play/Pause"
                    >
                      {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={toggleMute}
                      className="p-1.5 bg-[#1f2127] hover:bg-[#2c2f38] text-gray-300 hover:text-white border border-[#353842] cursor-pointer"
                      aria-label="Toggle Mute"
                    >
                      {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowCaptions(!showCaptions)}
                      className={`px-2 py-1 text-[10px] font-mono uppercase font-bold border cursor-pointer transition-colors ${
                        showCaptions
                          ? "bg-amber-500 text-black border-amber-500"
                          : "bg-[#181a1f] text-gray-400 border-[#2f323a]"
                      }`}
                    >
                      CC {showCaptions ? "ON" : "OFF"}
                    </button>
                    <span className="text-[10px] font-mono text-gray-400">
                      {clipFormat}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Action Buttons below preview */}
          {activeClip && (
            <div className="w-full max-w-[280px] sm:max-w-[300px] mt-4 flex flex-col gap-2">
              <a
                href={activeMediaUrl}
                download={`clip-${activeClip.id}.mp4`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-xs uppercase tracking-wider border border-amber-500 flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download This Clip (MP4)</span>
              </a>

              <button
                onClick={() => handleCopy(activeMediaUrl)}
                className="w-full py-2 px-3 bg-[#181a1f] hover:bg-[#22252c] text-gray-200 border border-[#30333d] text-xs font-mono uppercase flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Link Copied to Clipboard!" : "Copy Video Link"}</span>
              </button>

              <div className="flex items-center justify-between text-[11px] font-mono text-gray-400 pt-1">
                <span>Render: FFmpeg H.264</span>
                <span>Audio: 320kbps AAC</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
