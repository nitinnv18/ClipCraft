"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { getMediaUrl } from "@/lib/utils";
import { VideoJob } from "@/types";
import {
  Scissors,
  Settings2,
  Clock,
  ArrowRight,
  Zap,
  Subtitles,
  Cloud,
} from "lucide-react";

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  // Form State
  const [activeTab, setActiveTab] = useState<"upload" | "youtube">("upload");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [clipCount, setClipCount] = useState(5);
  const [durationRange, setDurationRange] = useState<"15-30" | "30-60" | "60-90">("30-60");
  const [format, setFormat] = useState("9:16");
  const [captions, setCaptions] = useState(true);
  const [saveToCloud, setSaveToCloud] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState("");
  const [recentJobs, setRecentJobs] = useState<VideoJob[]>([]);

  // Set browser title
  useEffect(() => {
    document.title = "ClipCraft - Dashboard";
  }, []);

  // Pick up query param url or tab if passed from landing page
  useEffect(() => {
    const tabFromQuery = searchParams.get("tab");
    if (tabFromQuery === "youtube" || tabFromQuery === "upload") {
      setActiveTab(tabFromQuery);
    }
    const urlFromQuery = searchParams.get("url");
    if (urlFromQuery) {
      setYoutubeUrl(urlFromQuery);
      setActiveTab("youtube");
    }
  }, [searchParams]);

  // Load recent jobs
  useEffect(() => {
    if (user) {
      api
        .listJobs()
        .then((jobs) => setRecentJobs(jobs.slice(0, 3)))
        .catch(() => {});
    }
  }, [user]);

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

    if (activeTab === "youtube" && !youtubeUrl.trim()) {
      setError("Please enter a YouTube video URL.");
      return;
    }

    if (activeTab === "upload" && !selectedFile) {
      setError("Please select or drop a video file to upload.");
      return;
    }

    if (!user) {
      const redirectUrl = activeTab === "youtube" 
        ? `/dashboard?url=${encodeURIComponent(youtubeUrl.trim())}`
        : "/dashboard?tab=upload";
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

    setIsSubmitting(true);
    try {
      if (activeTab === "upload" && selectedFile) {
        setUploadStatusText("Uploading video file to ClipCraft engine...");
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("clipCount", String(clipCount));
        formData.append("minDuration", String(minDur));
        formData.append("maxDuration", String(maxDur));
        formData.append("formatRatio", format);
        formData.append("captions", String(captions));
        formData.append("saveToCloud", String(saveToCloud));

        const job = await api.createUploadJob(formData);
        router.push(`/jobs/${job.id}`);
      } else if (activeTab === "youtube") {
        setUploadStatusText("Initiating YouTube video extraction & analysis...");
        const job = await api.createJob({
          youtubeUrl: youtubeUrl.trim(),
          clipCount,
          minDuration: minDur,
          maxDuration: maxDur,
          format: format,
          captions,
          saveToCloud,
        });
        router.push(`/jobs/${job.id}`);
      }
    } catch (err: any) {
      setError(err.message || "Failed to create clipping job. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center gap-8 py-4 sm:py-8 max-w-5xl mx-auto px-4 sm:px-6">
      {/* Page Header */}
      <div className="text-center flex flex-col gap-2 max-w-2xl">
        <div className="inline-flex items-center justify-center gap-2 text-xs font-mono font-semibold uppercase tracking-widest text-amber-500 bg-[#17191e] border border-[#272a31] py-1 px-3.5 mx-auto">
          <span>AI Clip Generation Engine</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold uppercase tracking-tight text-white">
          Create Viral Short Clips
        </h1>
        <p className="text-xs sm:text-sm text-gray-400 max-w-xl mx-auto">
          Upload your raw video file or paste a YouTube link. AI extracts high-retention viral moments, applies 9:16 vertical re-framing, burns styled subtitles, and renders ready-to-publish short clips.
        </p>
      </div>

      {/* Main Clipper Box */}
      <div className="w-full max-w-3xl">
        {/* Dual Input Tabs - Upload File Priority */}
        <div className="flex border-b border-[#2b2e36] mb-0 bg-[#0e1013]">
          <button
            type="button"
            onClick={() => { setActiveTab("upload"); setError(null); }}
            className={`flex-1 py-3.5 px-4 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === "upload"
                ? "border-amber-500 text-amber-400 bg-[#16181e]"
                : "border-transparent text-gray-400 hover:text-gray-200 hover:bg-[#121418]"
            }`}
          >
            <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <span>Upload Video File (MP4/MOV)</span>
            <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/40 px-1.5 py-0.5 rounded font-mono font-normal">Recommended</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab("youtube"); setError(null); }}
            className={`flex-1 py-3.5 px-4 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === "youtube"
                ? "border-amber-500 text-amber-400 bg-[#16181e]"
                : "border-transparent text-gray-400 hover:text-gray-200 hover:bg-[#121418]"
            }`}
          >
            <svg className="w-4 h-4 text-red-500 fill-current" viewBox="0 0 24 24">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
            <span>YouTube URL</span>
          </button>
        </div>

        <Card className="border-[#2b2e36] border-t-0 bg-[#121316] p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            {error && (
              <div className="p-3.5 bg-red-950 border border-red-600 text-red-200 text-xs font-mono">
                {error}
              </div>
            )}

            {/* Tab 1: Direct File Upload Dropzone (Primary) */}
            {activeTab === "upload" && (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-gray-200 uppercase tracking-wider flex items-center justify-between">
                  <span>Select or Drag Video File</span>
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
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                        ✓
                      </div>
                      <p className="text-sm font-bold text-white truncate max-w-md">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-gray-400 font-mono">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB &bull; Click or drag to replace
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-[#252830] text-amber-400 flex items-center justify-center">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
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
            )}

            {/* Tab 2: YouTube URL Input */}
            {activeTab === "youtube" && (
              <div className="flex flex-col gap-2">
                <label htmlFor="yt-url" className="text-xs font-bold text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-red-500 fill-current" viewBox="0 0 24 24">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                  Paste YouTube URL
                </label>
                <div className="relative">
                  <input
                    id="yt-url"
                    type="text"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    className="w-full bg-[#181a1f] text-gray-100 placeholder-gray-500 border border-[#323640] px-4 py-3 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-mono transition-colors"
                  />
                </div>
              </div>
            )}

            {/* Quick Option Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Number of clips */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  Number of Clips
                </label>
                <select
                  value={clipCount}
                  onChange={(e) => setClipCount(Number(e.target.value))}
                  className="w-full bg-[#181a1f] text-gray-100 border border-[#323640] px-3.5 py-2.5 text-xs font-semibold uppercase focus:outline-none focus:border-amber-500"
                >
                  <option value={3}>3 Clips</option>
                  <option value={5}>5 Clips (Recommended)</option>
                  <option value={7}>7 Clips</option>
                  <option value={10}>10 Clips</option>
                </select>
              </div>

              {/* Clip duration */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  Clip Duration
                </label>
                <select
                  value={durationRange}
                  onChange={(e) => setDurationRange(e.target.value as any)}
                  className="w-full bg-[#181a1f] text-gray-100 border border-[#323640] px-3.5 py-2.5 text-xs font-semibold uppercase focus:outline-none focus:border-amber-500"
                >
                  <option value="15-30">15 – 30 sec (Quick)</option>
                  <option value="30-60">30 – 60 sec (Optimal)</option>
                  <option value="60-90">60 – 90 sec (Extended)</option>
                </select>
              </div>

              {/* Format */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  Video Format
                </label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="w-full bg-[#181a1f] text-gray-100 border border-[#323640] px-3.5 py-2.5 text-xs font-semibold uppercase focus:outline-none focus:border-amber-500"
                >
                  <option value="9:16">9:16 Vertical (Shorts/TikTok)</option>
                  <option value="1:1">1:1 Square (Feed)</option>
                  <option value="16:9">16:9 Landscape</option>
                </select>
              </div>
            </div>

            {/* Toggles: Captions & Cloud Storage */}
            <div className="flex flex-wrap items-center justify-between gap-4 py-3 border-y border-[#22252c]">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCaptions(!captions)}
                  className={`px-3.5 py-2 border text-xs font-bold uppercase font-mono flex items-center gap-2 transition-colors ${
                    captions
                      ? "bg-amber-500 border-amber-500 text-black"
                      : "bg-[#16181d] border-[#323642] text-gray-400 hover:text-white"
                  }`}
                  title="Toggle Subtitles/Captions Burning on Clips"
                >
                  <Subtitles className="w-4 h-4" />
                  <span>Captions: {captions ? "ON" : "OFF"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSaveToCloud(!saveToCloud)}
                  className={`px-3.5 py-2 border text-xs font-bold uppercase font-mono flex items-center gap-2 transition-colors ${
                    saveToCloud
                      ? "bg-[#13241b] border-emerald-600 text-emerald-400"
                      : "bg-[#16181d] border-[#323642] text-gray-400 hover:text-white"
                  }`}
                >
                  <Cloud className="w-4 h-4" />
                  <span>Save to Cloud: {saveToCloud ? "ON" : "OFF"}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs uppercase font-medium text-gray-400 hover:text-white flex items-center gap-1 font-mono"
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
                <div className="flex items-center justify-between">
                  <span>Subtitle Typography:</span>
                  <span className="text-gray-200 font-bold">Sharp High-Contrast Sans</span>
                </div>
              </div>
            )}

            {/* Main CTA */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isSubmitting}
              className="w-full text-sm font-black py-4 flex items-center justify-center gap-2"
            >
              <Scissors className="w-4 h-4" />
              {isSubmitting ? (uploadStatusText || "Processing...") : (activeTab === "upload" ? "Upload & Generate Clips" : "Generate Clips")}
            </Button>
          </form>
        </Card>
      </div>

      {/* Recent Jobs Section */}
      {recentJobs.length > 0 && (
        <div className="w-full max-w-3xl mt-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" />
              Recent Jobs
            </h2>
            <button
              onClick={() => router.push("/history")}
              className="text-xs uppercase font-bold text-amber-400 hover:underline flex items-center gap-1"
            >
              View All History <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {recentJobs.map((job) => (
              <Card
                key={job.id}
                className="p-4 bg-[#141518] hover:bg-[#181a1e] border-[#272a31] cursor-pointer transition-colors flex items-center justify-between gap-4"
                onClick={() => router.push(`/jobs/${job.id}`)}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-16 h-10 bg-[#22242a] flex-shrink-0 relative overflow-hidden border border-[#30333d]">
                    {job.thumbnail ? (
                      <img
                        src={getMediaUrl(job.thumbnail)}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-500 font-mono">
                        VIDEO
                      </div>
                    )}
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-white truncate">{job.title || "Video Job"}</p>
                    <p className="text-[11px] text-gray-400 font-mono">
                      {new Date(job.createdAt).toLocaleDateString()} &bull; {job.clipCount} Clips &bull; {job.settings.format}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <Badge variant={job.status as any}>{job.status}</Badge>
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                </div>
              </Card>
            ))}
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
