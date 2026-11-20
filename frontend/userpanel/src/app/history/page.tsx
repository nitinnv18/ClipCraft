"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { VideoJob } from "@/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { getMediaUrl } from "@/lib/utils";
import {
  History,
  Scissors,
  Trash2,
  RefreshCw,
  Video,
  Film,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from "lucide-react";

export default function HistoryPage() {
  const router = useRouter();

  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  useEffect(() => {
    document.title = "ClipCraft - Job History";
  }, []);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const data = await api.listJobs();
      setJobs(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load job history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this job and its generated clips?")) return;
    setDeletingId(id);
    try {
      await api.deleteJob(id);
      setJobs((prev) => prev.filter((j) => j.id !== id));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete job.");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredJobs = jobs.filter((j) => {
    const matchesFilter = statusFilter === "all" || j.status === statusFilter;
    const matchesSearch =
      !search.trim() ||
      j.title?.toLowerCase().includes(search.toLowerCase()) ||
      j.youtubeUrl?.toLowerCase().includes(search.toLowerCase()) ||
      j.id?.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  const totalCompleted = jobs.filter((j) => j.status === "completed").length;
  const totalClips = jobs.reduce((acc, j) => acc + (j.clips?.length ?? 0), 0);
  const totalPages = Math.ceil(filteredJobs.length / ITEMS_PER_PAGE) || 1;
  const paginatedJobs = filteredJobs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="w-full flex flex-col items-center py-6 sm:py-10 max-w-7xl mx-auto px-4 sm:px-6">
      {/* Header Banner */}
      <div className="w-full max-w-4xl text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#14161a] border border-[#262931] text-[11px] font-mono uppercase tracking-widest text-amber-400 mb-4">
          <History className="w-3.5 h-3.5" />
          Processing Archives &amp; Vault
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold uppercase tracking-tight text-white mb-2">
          Video Job History
        </h1>
        <p className="text-xs sm:text-sm text-gray-400 max-w-xl mx-auto">
          Access all your past clipping workflows, review rendered vertical shorts, and export clips.
        </p>
      </div>

      {/* Metrics Row */}
      <div className="w-full max-w-4xl grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
        <div className="bg-[#121316] border border-[#272a30] p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400">Total Jobs</span>
            <div className="text-xl font-bold font-mono text-white mt-0.5">{jobs.length}</div>
          </div>
          <Video className="w-5 h-5 text-gray-500" />
        </div>

        <div className="bg-[#121316] border border-[#272a30] p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400">Completed Jobs</span>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">{totalCompleted}</div>
          </div>
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
        </div>

        <div className="bg-[#121316] border border-[#272a30] p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400">Total Clips Rendered</span>
            <div className="text-xl font-bold font-mono text-amber-400 mt-0.5">{totalClips}</div>
          </div>
          <Film className="w-5 h-5 text-amber-500" />
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="w-full max-w-4xl bg-[#121316] border border-[#272a30] p-4 flex flex-col sm:flex-row items-center justify-between gap-3 mb-6">
        <div className="relative flex-1 w-full">
          <input
            type="text"
            placeholder="Search by video title, URL, or job ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#181a1f] text-gray-100 placeholder-gray-500 border border-[#323640] px-3.5 py-2 text-xs font-mono focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#181a1f] text-gray-200 border border-[#323640] pl-3 pr-8 py-2 text-xs font-mono uppercase focus:outline-none focus:border-amber-500 appearance-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="processing">Processing</option>
              <option value="failed">Failed</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <Button variant="outline" size="sm" onClick={loadJobs} isLoading={loading} className="font-mono text-xs">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>

          <Link href="/dashboard">
            <Button variant="primary" size="sm" className="font-bold flex items-center gap-1.5 whitespace-nowrap">
              <Scissors className="w-3.5 h-3.5" />
              <span>New Job</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Jobs List */}
      <div className="w-full max-w-4xl">
        {loading && jobs.length === 0 ? (
          <div className="p-12 text-center text-xs font-mono text-gray-400 bg-[#121316] border border-[#272a30]">
            Loading video job archives...
          </div>
        ) : error && jobs.length === 0 ? (
          <div className="p-6 bg-red-950 border border-red-700 text-red-200 text-xs font-mono flex items-center justify-between">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={loadJobs}>
              Retry
            </Button>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="p-12 text-center text-xs font-mono text-gray-400 bg-[#121316] border border-[#272a30] flex flex-col items-center gap-3">
            <Video className="w-8 h-8 text-gray-600" />
            <span>{search || statusFilter !== "all" ? "No jobs match your search filters." : "No video clipping jobs found yet."}</span>
            <Link href="/dashboard">
              <Button variant="primary" size="sm" className="font-bold mt-2">
                Generate Your First Clips &rarr;
              </Button>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {paginatedJobs.map((job) => (
              <Card
                key={job.id}
                className="p-4 bg-[#141518] hover:bg-[#181a1e] border-[#272a31] cursor-pointer transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                onClick={() => router.push(`/jobs/${job.id}`)}
              >
                <div className="flex items-center gap-3.5 overflow-hidden flex-1 min-w-0">
                  <div className="w-20 h-12 bg-[#202228] flex-shrink-0 relative overflow-hidden border border-[#30333d]">
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

                  <div className="overflow-hidden flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">{job.title || "Video Clipping Job"}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-gray-400 font-mono">
                      <span>{new Date(job.createdAt).toLocaleDateString()}</span>
                      <span>&bull;</span>
                      <span>{job.clipCount} Clips Requested</span>
                      {job.duration ? (
                        <>
                          <span>&bull;</span>
                          <span>{Math.floor(job.duration / 60)}m {Math.floor(job.duration % 60)}s</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-[#22252c]">
                  <Badge variant={job.status}>{job.status}</Badge>

                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/jobs/${job.id}`);
                      }}
                      className="text-xs font-semibold"
                    >
                      View Clips
                    </Button>

                    <button
                      onClick={(e) => handleDelete(e, job.id)}
                      disabled={deletingId === job.id}
                      title="Delete Job"
                      className="p-2 bg-[#1a1c22] hover:bg-red-950 border border-[#2c303a] hover:border-red-700 text-gray-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </Card>
            ))}

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-[#22252c] text-xs font-mono text-gray-400">
                <span>
                  Showing Page {currentPage} of {totalPages} ({filteredJobs.length} total)
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="p-1.5"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="p-1.5"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
