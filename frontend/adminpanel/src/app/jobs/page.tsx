"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { adminApi } from "@/lib/adminApi";
import { logger } from "@/lib/logger";
import { AdminJobRow } from "@/types/admin";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/utils";
import {
  Video,
  Search,
  RotateCcw,
  Ban,
  Eye,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Cloud,
  Laptop,
  Flame,
} from "lucide-react";

export default function AdminJobsPage() {
  const [jobs, setJobs] = useState<AdminJobRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [modeFilter, setModeFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog State
  const [selectedJob, setSelectedJob] = useState<AdminJobRow | null>(null);
  const [actionType, setActionType] = useState<"retry" | "cancel" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [isSweeping, setIsSweeping] = useState(false);

  const handleSweepStuck = async () => {
    if (!window.confirm("Clear all jobs stuck in queue/processing for more than 20 minutes?")) return;
    setIsSweeping(true);
    try {
      const res = await adminApi.purgeStuckJobs(20);
      alert(res.message);
      loadJobs();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to clear stuck jobs.");
    } finally {
      setIsSweeping(false);
    }
  };

  const loadJobs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await adminApi.listJobs({
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        stage: stageFilter || undefined,
        mode: modeFilter || undefined,
        page,
        limit,
      });
      setJobs(res.jobs);
      setTotal(res.total);
    } catch (err) {
      logger.error("Failed to load jobs list", err);
      setError(err instanceof Error ? err.message : "Failed to load jobs list.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, [page, statusFilter, stageFilter, modeFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadJobs();
  };

  const handleConfirmAction = async () => {
    if (!selectedJob || !actionType) return;
    setActionLoading(true);
    try {
      if (actionType === "retry") {
        await adminApi.retryJob(selectedJob.id);
      } else if (actionType === "cancel") {
        await adminApi.cancelJob(selectedJob.id);
      }
      setActionType(null);
      setSelectedJob(null);
      loadJobs();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to execute action.");
    } finally {
      setActionLoading(false);
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="flex flex-col gap-6">
      {/* Confirm Dialog */}
      {selectedJob && actionType && (
        <ConfirmDialog
          isOpen={true}
          title={actionType === "retry" ? `Requeue Job ${selectedJob.id}` : `Cancel Processing Job ${selectedJob.id}`}
          description={
            actionType === "retry"
              ? "The worker thread will reset processing state and re-execute AI transcript extraction and FFmpeg clipping."
              : "The active job processing will be immediately aborted and marked as cancelled."
          }
          confirmLabel={actionType === "retry" ? "Requeue Job" : "Cancel Job"}
          isDestructive={actionType === "cancel"}
          isLoading={actionLoading}
          onConfirm={handleConfirmAction}
          onClose={() => {
            setActionType(null);
            setSelectedJob(null);
          }}
        />
      )}

      {/* Header & Filter Controls */}
      <div className="bg-[#121316] border border-[#272a30] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center gap-2 max-w-md">
          <div className="relative flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Job ID, title, URL, or user..."
              className="w-full bg-[#181a1f] border border-[#30333d] px-3.5 py-2 text-xs font-mono text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm" className="font-mono text-xs">
            <Search className="w-3.5 h-3.5" />
          </Button>
        </form>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <select
              value={modeFilter}
              onChange={(e) => {
                setModeFilter(e.target.value);
                setPage(1);
              }}
              className="bg-[#181a1f] border border-[#30333d] pl-3 pr-8 py-2 text-xs font-mono uppercase text-gray-200 focus:outline-none focus:border-amber-500 appearance-none cursor-pointer"
            >
              <option value="">All Modes</option>
              <option value="cloud">Cloud</option>
              <option value="on-device">On-Device</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="bg-[#181a1f] border border-[#30333d] pl-3 pr-8 py-2 text-xs font-mono uppercase text-gray-200 focus:outline-none focus:border-amber-500 appearance-none cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="queued">Queued</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={stageFilter}
              onChange={(e) => {
                setStageFilter(e.target.value);
                setPage(1);
              }}
              className="bg-[#181a1f] border border-[#30333d] pl-3 pr-8 py-2 text-xs font-mono uppercase text-gray-200 focus:outline-none focus:border-amber-500 appearance-none cursor-pointer"
            >
              <option value="">All Stages</option>
              <option value="initializing">Initializing</option>
              <option value="downloading">Downloading</option>
              <option value="transcribing">Transcribing</option>
              <option value="detecting">Detecting</option>
              <option value="clipping">Clipping</option>
              <option value="uploading">Uploading</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <Button variant="outline" size="sm" onClick={loadJobs} className="font-mono text-xs">
            <RefreshCw className="w-3 h-3" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSweepStuck}
            disabled={isSweeping}
            className="font-mono text-xs border-amber-500/40 text-amber-400 hover:bg-amber-500/10 flex items-center gap-1.5"
            title="Clear stale jobs stuck in queue/processing > 20m"
          >
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">{isSweeping ? "Clearing..." : "Sweep Stuck Jobs"}</span>
          </Button>
        </div>
      </div>

      {/* Jobs Table */}
      <div className="bg-[#121316] border border-[#272a30] overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs font-mono text-gray-400">
            Fetching video jobs...
          </div>
        ) : error ? (
          <div className="p-12 text-center text-xs font-mono text-red-400 flex flex-col items-center gap-3">
            <Video className="w-6 h-6 text-red-500" />
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={loadJobs}>
              Retry Connection
            </Button>
          </div>
        ) : jobs.length === 0 ? (
          <div className="p-12 text-center text-xs font-mono text-gray-400 flex flex-col items-center gap-2">
            <Video className="w-6 h-6 text-gray-500" />
            <span>No video jobs match your criteria.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-[#22252c] bg-[#15171c] text-gray-400 text-[10px] uppercase">
                  <th className="p-3">Job ID</th>
                  <th className="p-3">User</th>
                  <th className="p-3">Video Title</th>
                  <th className="p-3">Mode</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Stage</th>
                  <th className="p-3">Progress</th>
                  <th className="p-3">Clips</th>
                  <th className="p-3">Created</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2026]">
                {jobs.map((j) => (
                  <tr key={j.id} className="hover:bg-[#16181f] transition-colors">
                    <td className="p-3 text-white font-bold truncate max-w-[120px]">
                      {j.id}
                    </td>
                    <td className="p-3 text-gray-300 truncate max-w-[130px]">
                      {j.userEmail}
                    </td>
                    <td className="p-3 text-gray-200 max-w-[200px] truncate" title={j.title}>
                      {j.title}
                    </td>
                    <td className="p-3">
                      {j.processingMode === "on-device" || j.isClientRendered ? (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/70 text-emerald-400 border border-emerald-800/60"
                          title="Processed on client's local device"
                        >
                          <Laptop className="w-3 h-3 text-emerald-400" />
                          On-Device
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-950/70 text-sky-400 border border-sky-800/60"
                          title="Processed on server / cloud worker"
                        >
                          <Cloud className="w-3 h-3 text-sky-400" />
                          Cloud
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <StatusBadge status={j.status} />
                    </td>
                    <td className="p-3 text-gray-400 uppercase text-[10px]">
                      {j.stage}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-12 h-1.5 bg-[#22252d]">
                          <div
                            className={`h-full ${j.status === "failed" ? "bg-rose-500" : "bg-amber-500"}`}
                            style={{ width: `${j.progress}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-400">{j.progress}%</span>
                      </div>
                    </td>
                    <td className="p-3 text-gray-300">{j.clipCount}</td>
                    <td className="p-3 text-gray-400 text-[11px]">
                      {formatDate(j.createdAt)}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link href={`/jobs/${j.id}`}>
                          <button
                            title="Inspect Pipeline & Logs"
                            className="p-1.5 bg-[#1a1c22] hover:bg-[#252831] border border-[#2c303a] text-gray-300 hover:text-white"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </Link>

                        <button
                          onClick={() => {
                            setSelectedJob(j);
                            setActionType("retry");
                          }}
                          title="Retry Job"
                          className="p-1.5 bg-[#122419] hover:bg-[#193322] border border-emerald-800 text-emerald-400"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>

                        {["queued", "processing"].includes(j.status) && (
                          <button
                            onClick={() => {
                              setSelectedJob(j);
                              setActionType("cancel");
                            }}
                            title="Cancel Job"
                            className="p-1.5 bg-[#251518] hover:bg-[#381a1f] border border-rose-900 text-rose-400"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <div className="p-3 bg-[#101114] border-t border-[#22252c] flex items-center justify-between text-xs font-mono text-gray-400">
          <div>
            Showing {jobs.length} of {total} processing jobs
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
    </div>
  );
}
