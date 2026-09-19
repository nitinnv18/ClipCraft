"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { adminApi } from "@/lib/adminApi";
import { AdminClipRow } from "@/types/admin";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import {
  Film,
  Search,
  Trash2,
  Play,
  X,
  ExternalLink,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";

export default function AdminClipsPage() {
  const [clips, setClips] = useState<AdminClipRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(24);
  const [search, setSearch] = useState("");
  const [minScore, setMinScore] = useState<number | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  // Preview Modal
  const [previewClip, setPreviewClip] = useState<AdminClipRow | null>(null);

  // Delete Dialog
  const [deleteTarget, setDeleteTarget] = useState<AdminClipRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadClips = async () => {
    setIsLoading(true);
    try {
      const res = await adminApi.listClips({
        search: search.trim() || undefined,
        minScore,
        page,
        limit,
      });
      setClips(res.clips);
      setTotal(res.total);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadClips();
  }, [page, minScore]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadClips();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await adminApi.deleteClip(deleteTarget.id);
      setDeleteTarget(null);
      loadClips();
    } catch (err: any) {
      alert(err.message || "Failed to delete clip.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="flex flex-col gap-6">
      {/* Delete Confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          isOpen={true}
          title={`Delete Clip ${deleteTarget.title}`}
          description="Are you sure you want to delete this short clip? Associated storage will be freed."
          confirmLabel="Delete Clip"
          isDestructive={true}
          isLoading={deleteLoading}
          onConfirm={handleConfirmDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      {/* Video Preview Modal */}
      {previewClip && (
        <div className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#121316] border border-[#2b2e36] p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#22252c] pb-3">
              <div>
                <h3 className="text-xs font-bold uppercase text-white font-mono truncate max-w-[340px]">
                  {previewClip.title}
                </h3>
                <span className="text-[10px] font-mono text-gray-400">
                  {previewClip.duration}s &bull; Match {previewClip.score}% &bull; User: {previewClip.userEmail}
                </span>
              </div>
              <button
                onClick={() => setPreviewClip(null)}
                className="p-1 bg-[#181a1f] border border-[#2e313b] text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Video Player or Fallback */}
            <div className="w-full aspect-[9/16] max-h-[420px] bg-black border border-[#26282f] flex flex-col items-center justify-center relative overflow-hidden mx-auto">
              {previewClip.videoUrl ? (
                <video
                  src={previewClip.videoUrl}
                  controls
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="p-6 text-center text-xs font-mono text-gray-400 flex flex-col items-center gap-2">
                  <Film className="w-8 h-8 text-amber-500" />
                  <span>Media rendered locally</span>
                  <span className="text-[10px] text-gray-500">&ldquo;{previewClip.hook}&rdquo;</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#22252c] text-xs font-mono">
              <Link href={`/jobs/${previewClip.jobId}`} className="text-amber-400 hover:underline">
                Inspect Source Job &rarr;
              </Link>
              <Button variant="outline" size="sm" onClick={() => setPreviewClip(null)}>
                Close Preview
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-[#121316] border border-[#272a30] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center gap-2 max-w-md">
          <div className="relative flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by clip title, hook, or job ID..."
              className="w-full bg-[#181a1f] border border-[#30333d] px-3.5 py-2 text-xs font-mono text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm" className="font-mono text-xs">
            <Search className="w-3.5 h-3.5" />
          </Button>
        </form>

        <div className="flex items-center gap-3">
          <select
            value={minScore || ""}
            onChange={(e) => {
              setMinScore(e.target.value ? Number(e.target.value) : undefined);
              setPage(1);
            }}
            className="bg-[#181a1f] border border-[#30333d] px-3 py-2 text-xs font-mono uppercase text-gray-200 focus:outline-none focus:border-amber-500"
          >
            <option value="">All Scores</option>
            <option value="90">90%+ Top Match</option>
            <option value="80">80%+ High Quality</option>
            <option value="70">70%+ Standard</option>
          </select>

          <Button variant="outline" size="sm" onClick={loadClips} className="font-mono text-xs">
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Clips Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-xs font-mono text-gray-400 bg-[#121316] border border-[#272a30]">
          Loading clips library...
        </div>
      ) : clips.length === 0 ? (
        <div className="p-12 text-center text-xs font-mono text-gray-400 bg-[#121316] border border-[#272a30] flex flex-col items-center gap-2">
          <Film className="w-6 h-6 text-gray-500" />
          <span>No clips match your query.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {clips.map((c) => (
            <div
              key={c.id}
              className="bg-[#121316] border border-[#272a30] p-4 flex flex-col justify-between hover:border-[#3a3e4b] transition-colors"
            >
              <div>
                <div className="flex items-center justify-between mb-2 text-xs font-mono">
                  <span className="text-white font-bold uppercase truncate max-w-[160px]">
                    {c.title}
                  </span>
                  <span className="px-1.5 py-0.5 bg-[#122419] border border-emerald-800 text-emerald-400 text-[10px]">
                    {c.score}% Match
                  </span>
                </div>

                <div className="text-[10px] font-mono text-gray-400 mb-2 truncate">
                  User: {c.userEmail}
                </div>

                <p className="text-xs text-gray-300 font-mono line-clamp-2 mb-4">
                  &ldquo;{c.hook}&rdquo;
                </p>
              </div>

              <div className="pt-3 border-t border-[#1e2025] flex items-center justify-between text-xs font-mono">
                <span className="text-gray-400 text-[11px]">{c.duration}s</span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPreviewClip(c)}
                    className="p-1.5 bg-[#1a1c22] hover:bg-[#252831] border border-[#2c303a] text-red-500 hover:text-red-400"
                    title="Preview Video Player"
                  >
                    <Play className="w-3 h-3 fill-current" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(c)}
                    className="p-1.5 bg-[#1a1c22] hover:bg-rose-950 border border-[#2c303a] hover:border-rose-800 text-gray-400 hover:text-rose-400"
                    title="Delete Clip"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="p-3 bg-[#101114] border border-[#22252c] flex items-center justify-between text-xs font-mono text-gray-400">
        <div>
          Showing {clips.length} of {total} clips
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-2.5 py-1 bg-[#181a1f] border border-[#2c303a] disabled:opacity-40"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-white font-bold">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-2.5 py-1 bg-[#181a1f] border border-[#2c303a] disabled:opacity-40"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
