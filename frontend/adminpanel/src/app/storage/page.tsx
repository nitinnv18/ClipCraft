"use client";

import React, { useEffect, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import { AdminStorageData } from "@/types/admin";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import {
  HardDrive,
  Film,
  Image as ImageIcon,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Cloud,
} from "lucide-react";

export default function AdminStoragePage() {
  const [data, setData] = useState<AdminStorageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCleaning, setIsCleaning] = useState(false);
  const [showCleanupDialog, setShowCleanupDialog] = useState(false);
  const [cleanupSuccess, setCleanupSuccess] = useState<string | null>(null);

  const loadStorage = async () => {
    setIsLoading(true);
    try {
      const res = await adminApi.getStorage();
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStorage();
  }, []);

  const handleCleanup = async () => {
    setIsCleaning(true);
    setCleanupSuccess(null);
    try {
      const res = await adminApi.triggerCleanup("all");
      setCleanupSuccess(`Cleaned ${res.cleanedFormatted} of temporary media cache.`);
      setShowCleanupDialog(false);
      loadStorage();
    } catch (err: any) {
      alert(err.message || "Failed to trigger storage cleanup.");
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
  const cleanup = data?.cleanupPreview;

  return (
    <div className="flex flex-col gap-6">
      {/* Cleanup Dialog */}
      {showCleanupDialog && (
        <ConfirmDialog
          isOpen={true}
          title="Execute Storage Cleanup"
          description={`This will safely purge approximately ${cleanup?.orphanedFormatted || "0 MB"} of temporary transcode cache files, orphan segment fragments, and failed job media.`}
          confirmLabel="Execute Cleanup"
          isDestructive={true}
          isLoading={isCleaning}
          onConfirm={handleCleanup}
          onClose={() => setShowCleanupDialog(false)}
        />
      )}

      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#121316] border border-[#272a30] p-4">
        <div>
          <h1 className="text-sm font-bold uppercase text-white font-mono">
            Storage &amp; Media Lifecycle
          </h1>
          <p className="text-[11px] font-mono text-gray-400">
            Real storage monitoring for rendered MP4 clips, thumbnails, and temporary audio tracks.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadStorage}
          className="flex items-center gap-1.5 font-mono text-xs"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Refresh Storage</span>
        </Button>
      </div>

      {cleanupSuccess && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs font-mono flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{cleanupSuccess}</span>
        </div>
      )}

      {/* Storage Breakdown Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Storage */}
        <div className="bg-[#121316] border border-[#272a30] p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-[10px] font-mono uppercase">Total Space Used</span>
            <HardDrive className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-white">{s?.totalFormatted}</div>
            <div className="text-[10px] font-mono text-gray-400 mt-1">
              Across all media types
            </div>
          </div>
        </div>

        {/* Clip Storage */}
        <div className="bg-[#121316] border border-[#272a30] p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-[10px] font-mono uppercase">Rendered Clips</span>
            <Film className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-emerald-400">{s?.clipStorageFormatted}</div>
            <div className="text-[10px] font-mono text-gray-400 mt-1">
              {counts?.clips} MP4 video files
            </div>
          </div>
        </div>

        {/* Thumbnails */}
        <div className="bg-[#121316] border border-[#272a30] p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-[10px] font-mono uppercase">Thumbnails</span>
            <ImageIcon className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-white">{s?.thumbnailStorageFormatted}</div>
            <div className="text-[10px] font-mono text-gray-400 mt-1">
              {counts?.thumbnails} image covers
            </div>
          </div>
        </div>

        {/* Temp Cache */}
        <div className="bg-[#121316] border border-[#272a30] p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-[10px] font-mono uppercase">Temp Transcode Cache</span>
            <Trash2 className="w-4 h-4 text-rose-400" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-white">{s?.tempCacheFormatted}</div>
            <div className="text-[10px] font-mono text-gray-400 mt-1">
              {counts?.tempFiles} intermediate files
            </div>
          </div>
        </div>
      </div>

      {/* Cloudinary & Cleanup Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Controlled Cleanup Box */}
        <div className="bg-[#121316] border border-[#272a30] p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-[#22252c]">
              <Trash2 className="w-4 h-4 text-rose-500" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                Controlled Storage Cleanup
              </h2>
            </div>

            <p className="text-xs text-gray-300 font-sans leading-relaxed mb-4">
              Purge orphaned video tracks, temporary FFmpeg segments, and failed job artifacts without affecting live user clips.
            </p>

            <div className="p-3 bg-[#171416] border border-[#2d2226] text-xs font-mono mb-6 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Estimated Reclaimable Space:</span>
                <span className="text-rose-400 font-bold">{cleanup?.orphanedFormatted || "0 MB"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Target Temp Cache Files:</span>
                <span className="text-white font-bold">{cleanup?.tempFilesCount || 0} Files</span>
              </div>
            </div>
          </div>

          <Button
            variant="danger"
            size="md"
            onClick={() => setShowCleanupDialog(true)}
            className="w-full flex items-center justify-center gap-2 font-bold"
          >
            <Trash2 className="w-4 h-4" />
            <span>Purge Temporary Storage</span>
          </Button>
        </div>

        {/* Cloudinary Integration State */}
        <div className="bg-[#121316] border border-[#272a30] p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-[#22252c]">
              <Cloud className="w-4 h-4 text-amber-500" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                Cloud Provider Status
              </h2>
            </div>

            <div className="flex flex-col gap-3 text-xs font-mono">
              <div className="flex items-center justify-between py-1 border-b border-[#1c1e24]">
                <span className="text-gray-400">Storage Provider:</span>
                <span className="text-white font-bold">Cloudinary / Local Disk Fallback</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-[#1c1e24]">
                <span className="text-gray-400">Active Cloud Bucket:</span>
                <span className="text-emerald-400 font-bold">{data?.cloudinary.cloudName}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-[#1c1e24]">
                <span className="text-gray-400">Auto-Retention Rule:</span>
                <span className="text-white font-bold">30 Days Maximum Storage</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-[#1c1e24]">
                <span className="text-gray-400">Media API Secrets:</span>
                <span className="text-emerald-400 font-bold">Isolated Server-Side</span>
              </div>
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
