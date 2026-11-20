"use client";

import React, { useEffect, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import { logger } from "@/lib/logger";
import { AdminStorageData } from "@/types/admin";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import {
  Film,
  Image as ImageIcon,
  Trash2,
  CheckCircle2,
  RefreshCw,
  Cloud,
  Database,
  Server,
  AlertTriangle,
  Sparkles,
} from "lucide-react";

type CleanupCategory = "temp" | "thumbnails" | "clips" | "database" | "all";

interface CleanupConfig {
  category: CleanupCategory;
  title: string;
  description: string;
  confirmLabel: string;
  requireKeyword?: string;
  isDestructive: boolean;
}

export default function AdminStoragePage() {
  const [data, setData] = useState<AdminStorageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCleaning, setIsCleaning] = useState(false);
  const [activeCleanup, setActiveCleanup] = useState<CleanupConfig | null>(null);
  const [cleanupSuccess, setCleanupSuccess] = useState<string | null>(null);

  const loadStorage = async () => {
    setIsLoading(true);
    try {
      const res = await adminApi.getStorage();
      setData(res);
    } catch (err) {
      logger.error("Failed to load storage status", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStorage();
  }, []);

  const openCleanupModal = (category: CleanupCategory) => {
    switch (category) {
      case "thumbnails":
        setActiveCleanup({
          category: "thumbnails",
          title: "Purge CDN Thumbnails",
          description: `This will delete all thumbnail image covers (${data?.summary.thumbnailStorageFormatted || "54.3 MB"}, ${data?.counts.thumbnails || 0} covers) from Cloudinary CDN and clear thumbnail references. Video clips and user accounts remain completely untouched.`,
          confirmLabel: "Purge Thumbnails",
          isDestructive: true,
        });
        break;
      case "clips":
        setActiveCleanup({
          category: "clips",
          title: "Purge Rendered Video Clips",
          description: `This will permanently delete all rendered MP4 short clips (${data?.summary.clipStorageFormatted || "0 MB"}, ${data?.counts.clips || 0} files) from Cloudinary CDN and MongoDB clip collections to free up storage quota.`,
          confirmLabel: "Purge Clips",
          requireKeyword: "CLIPS",
          isDestructive: true,
        });
        break;
      case "database":
        setActiveCleanup({
          category: "database",
          title: "Prune MongoDB Database",
          description: `This will prune old completed, cancelled, and failed job execution logs and orphaned moment records from MongoDB. User accounts and login credentials will NEVER be touched.`,
          confirmLabel: "Prune Database",
          isDestructive: true,
        });
        break;
      case "temp":
        setActiveCleanup({
          category: "temp",
          title: "Purge Scratch Temp Disk",
          description: `This will safely purge approximately ${data?.summary.tempCacheFormatted || "0 MB"} of temporary transcode cache files and audio upload chunks in ./backend/tmp_media. CDN assets and MongoDB are 100% protected.`,
          confirmLabel: "Purge Scratch Disk",
          isDestructive: true,
        });
        break;
      case "all":
        setActiveCleanup({
          category: "all",
          title: "Execute Master Full System Purge",
          description: `CAUTION: This will clean ALL temporary scratch files, purge Cloudinary CDN thumbnails and rendered video clips, and prune completed/failed job logs from MongoDB in one master operation. User accounts remain safe.`,
          confirmLabel: "Execute Master Purge",
          requireKeyword: "PURGE",
          isDestructive: true,
        });
        break;
    }
  };

  const handleExecuteCleanup = async () => {
    if (!activeCleanup) return;
    setIsCleaning(true);
    setCleanupSuccess(null);
    try {
      const res = await adminApi.triggerCleanup(activeCleanup.category);
      setCleanupSuccess(res.message || `Cleaned ${res.cleanedFormatted || "storage"} successfully.`);
      setActiveCleanup(null);
      await loadStorage();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to trigger storage cleanup.");
    } finally {
      setIsCleaning(false);
    }
  };

  if (isLoading && !data) {
    return (
      <div className="p-12 text-center text-xs font-mono text-gray-400">
        Analyzing disk and cloud storage...
      </div>
    );
  }

  const s = data?.summary;
  const counts = data?.counts;
  const layers = data?.layers;

  return (
    <div className="flex flex-col gap-6">
      {/* Dynamic Confirmation Dialog */}
      {activeCleanup && (
        <ConfirmDialog
          isOpen={true}
          title={activeCleanup.title}
          description={activeCleanup.description}
          confirmLabel={activeCleanup.confirmLabel}
          requireKeyword={activeCleanup.requireKeyword}
          isDestructive={activeCleanup.isDestructive}
          isLoading={isCleaning}
          onConfirm={handleExecuteCleanup}
          onClose={() => setActiveCleanup(null)}
        />
      )}

      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#121316] border border-[#272a30] p-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 bg-sky-500/10 text-sky-400 border border-sky-500/30">
              CDN: Video &amp; Thumbnails
            </span>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              MongoDB: Metadata
            </span>
          </div>
          <h1 className="text-sm font-bold uppercase text-white font-mono">
            Storage &amp; Media Lifecycle Management
          </h1>
          <p className="text-[11px] font-mono text-gray-400">
            Monitor and clean Cloudinary CDN clips, thumbnail covers, MongoDB database documents, and scratch disk cache.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="danger"
            size="sm"
            onClick={() => openCleanupModal("all")}
            className="flex items-center gap-1.5 font-mono text-xs font-bold"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Master Clean (All)</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={loadStorage}
            className="flex items-center gap-1.5 font-mono text-xs"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {cleanupSuccess && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs font-mono flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{cleanupSuccess}</span>
        </div>
      )}

      {/* 4 Storage Breakdown Cards with Direct Clean Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Rendered Clips (CDN) */}
        <div className="bg-[#121316] border border-[#272a30] p-5 flex flex-col justify-between relative overflow-hidden gap-4">
          <div>
            <div className="flex items-center justify-between text-gray-400 mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono uppercase text-gray-300 font-bold">Rendered Clips</span>
                <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 bg-sky-500/15 text-sky-400 border border-sky-500/30">
                  CDN
                </span>
              </div>
              <Film className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-sky-400">{s?.clipStorageFormatted}</div>
            <div className="text-[10px] font-mono text-gray-400 mt-1">
              {counts?.clips} MP4 videos <span className="text-sky-400/80">(Cloudinary CDN)</span>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openCleanupModal("clips")}
            className="w-full flex items-center justify-center gap-1.5 font-mono text-[11px] text-gray-300 hover:text-rose-400 hover:border-rose-700/60"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clean Clips</span>
          </Button>
        </div>

        {/* Card 2: Thumbnails (CDN) */}
        <div className="bg-[#121316] border border-[#272a30] p-5 flex flex-col justify-between relative overflow-hidden gap-4">
          <div>
            <div className="flex items-center justify-between text-gray-400 mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono uppercase text-gray-300 font-bold">Thumbnails</span>
                <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 bg-sky-500/15 text-sky-400 border border-sky-500/30">
                  CDN
                </span>
              </div>
              <ImageIcon className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white">{s?.thumbnailStorageFormatted}</div>
            <div className="text-[10px] font-mono text-gray-400 mt-1">
              {counts?.thumbnails} image covers <span className="text-sky-400/80">(Cloudinary CDN)</span>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openCleanupModal("thumbnails")}
            className="w-full flex items-center justify-center gap-1.5 font-mono text-[11px] text-gray-300 hover:text-sky-400 hover:border-sky-700/60"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clean Thumbnails</span>
          </Button>
        </div>

        {/* Card 3: MongoDB Database (Metadata) */}
        <div className="bg-[#121316] border border-[#272a30] p-5 flex flex-col justify-between relative overflow-hidden gap-4">
          <div>
            <div className="flex items-center justify-between text-gray-400 mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono uppercase text-gray-300 font-bold">Database Storage</span>
                <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  MongoDB
                </span>
              </div>
              <Database className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-400">
              {layers?.mongodb?.formatted || "~24 KB"}
            </div>
            <div className="text-[10px] font-mono text-gray-400 mt-1">
              {layers?.mongodb?.totalDocuments || ((counts?.clips || 0) + (counts?.thumbnails || 0))} JSON docs (Users &amp; Jobs)
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openCleanupModal("database")}
            className="w-full flex items-center justify-center gap-1.5 font-mono text-[11px] text-gray-300 hover:text-emerald-400 hover:border-emerald-700/60"
          >
            <Trash2 className="w-3 h-3" />
            <span>Prune DB History</span>
          </Button>
        </div>

        {/* Card 4: Temp Scratch Cache (Local Disk) */}
        <div className="bg-[#121316] border border-[#272a30] p-5 flex flex-col justify-between relative overflow-hidden gap-4">
          <div>
            <div className="flex items-center justify-between text-gray-400 mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono uppercase text-gray-300 font-bold">Temp Scratch Disk</span>
                <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  Server Disk
                </span>
              </div>
              <Server className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white">{s?.tempCacheFormatted}</div>
            <div className="text-[10px] font-mono text-gray-400 mt-1">
              {counts?.tempFiles} cache files <span className="text-amber-400/80">(./tmp_media)</span>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openCleanupModal("temp")}
            className="w-full flex items-center justify-center gap-1.5 font-mono text-[11px] text-gray-300 hover:text-amber-400 hover:border-amber-700/60"
          >
            <Trash2 className="w-3 h-3" />
            <span>Purge Scratch</span>
          </Button>
        </div>
      </div>

      {/* Controlled Cleanup Operations Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Granular Storage Cleanup Console */}
        <div className="bg-[#121316] border border-[#272a30] p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#22252c]">
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-500" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                  Controlled Granular Cleanup Console
                </h2>
              </div>
              <span className="text-[10px] font-mono text-gray-400">Select Specific Target</span>
            </div>

            <p className="text-xs text-gray-300 font-sans leading-relaxed mb-4">
              Choose the exact layer you want to purge. User accounts, passwords, and active jobs are always safeguarded.
            </p>

            <div className="flex flex-col gap-2.5 mb-6">
              {/* Option 1: CDN Thumbnails */}
              <div className="p-3 bg-[#16171b] border border-[#262830] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <ImageIcon className="w-4 h-4 text-sky-400 flex-shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-white font-mono">1. CDN Thumbnails &amp; Covers</div>
                    <div className="text-[10px] text-gray-400">
                      Purges {s?.thumbnailStorageFormatted} ({counts?.thumbnails} covers) from Cloudinary CDN.
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openCleanupModal("thumbnails")}
                  className="font-mono text-xs flex-shrink-0 border-sky-800/60 text-sky-300 hover:bg-sky-950/40"
                >
                  Clean Covers
                </Button>
              </div>

              {/* Option 2: Rendered Clips */}
              <div className="p-3 bg-[#16171b] border border-[#262830] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Film className="w-4 h-4 text-sky-400 flex-shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-white font-mono">2. Rendered MP4 Video Clips</div>
                    <div className="text-[10px] text-gray-400">
                      Purges {s?.clipStorageFormatted} ({counts?.clips} clips) from Cloudinary CDN &amp; records.
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openCleanupModal("clips")}
                  className="font-mono text-xs flex-shrink-0 border-rose-800/60 text-rose-300 hover:bg-rose-950/40"
                >
                  Clean Clips
                </Button>
              </div>

              {/* Option 3: MongoDB Database */}
              <div className="p-3 bg-[#16171b] border border-[#262830] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Database className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-white font-mono">3. MongoDB Job History &amp; Logs</div>
                    <div className="text-[10px] text-gray-400">
                      Prunes finished job logs ({layers?.mongodb?.formatted || "436 KB"}). User accounts safe.
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openCleanupModal("database")}
                  className="font-mono text-xs flex-shrink-0 border-emerald-800/60 text-emerald-300 hover:bg-emerald-950/40"
                >
                  Prune DB
                </Button>
              </div>

              {/* Option 4: Scratch Temp Disk */}
              <div className="p-3 bg-[#16171b] border border-[#262830] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Server className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <div>
                    <div className="text-xs font-bold text-white font-mono">4. Server Local Scratch Disk</div>
                    <div className="text-[10px] text-gray-400">
                      Deletes intermediate FFmpeg chunks in ./tmp_media ({s?.tempCacheFormatted}).
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openCleanupModal("temp")}
                  className="font-mono text-xs flex-shrink-0 border-amber-800/60 text-amber-300 hover:bg-amber-950/40"
                >
                  Purge Temp
                </Button>
              </div>
            </div>
          </div>

          <Button
            variant="danger"
            size="md"
            onClick={() => openCleanupModal("all")}
            className="w-full flex items-center justify-center gap-2 font-bold uppercase tracking-wider text-xs"
          >
            <Sparkles className="w-4 h-4" />
            <span>Master Cleanup: Purge All Storage Layers</span>
          </Button>
        </div>

        {/* Cloud Provider & Infrastructure Status */}
        <div className="bg-[#121316] border border-[#272a30] p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-[#22252c]">
              <Cloud className="w-4 h-4 text-sky-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                Cloud Provider &amp; Infrastructure
              </h2>
            </div>

            <div className="flex flex-col gap-3 text-xs font-mono">
              <div className="flex items-center justify-between py-1 border-b border-[#1c1e24]">
                <span className="text-gray-400">Media CDN Provider:</span>
                <span className="text-sky-300 font-bold">Cloudinary Global CDN</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-[#1c1e24]">
                <span className="text-gray-400">Active Cloud Bucket:</span>
                <span className="text-emerald-400 font-bold">{data?.cloudinary.cloudName}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-[#1c1e24]">
                <span className="text-gray-400">Database Engine:</span>
                <span className="text-emerald-400 font-bold">MongoDB ({layers?.mongodb?.database || "clipcraft"})</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-[#1c1e24]">
                <span className="text-gray-400">Total MongoDB Documents:</span>
                <span className="text-white font-bold">{layers?.mongodb?.totalDocuments || 0} Docs</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-[#1c1e24]">
                <span className="text-gray-400">Client On-Device Mode:</span>
                <span className="text-emerald-400 font-bold">Active (Zero Server Storage Cost)</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-[#1c1e24]">
                <span className="text-gray-400">Media API Secrets:</span>
                <span className="text-emerald-400 font-bold">Isolated Server-Side</span>
              </div>
            </div>

            <div className="mt-6 p-3 bg-amber-950/20 border border-amber-800/40 text-[11px] font-mono text-amber-300/90 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <span>
                Tip: Pruning CDN Thumbnails or MongoDB database logs will instantly bring your Cloudinary and MongoDB usage down to 0 without affecting active users.
              </span>
            </div>
          </div>

          <div className="mt-6 pt-3 border-t border-[#1e2025] text-[11px] font-mono text-gray-400">
            Cloudinary API credentials are protected and never exposed to the client.
          </div>
        </div>
      </div>
    </div>
  );
}
