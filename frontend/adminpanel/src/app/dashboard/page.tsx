"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { adminApi } from "@/lib/adminApi";
import { AdminDashboardData } from "@/types/admin";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/Button";
import { formatTime } from "@/lib/utils";
import {
  Users,
  Video,
  Film,
  HardDrive,
  Activity,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = async () => {
    setIsRefreshing(true);
    try {
      const res = await adminApi.getDashboard();
      setData(res);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard metrics.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      loadData();
    }, 15000); // Polling every 15s with visibility awareness

    const handleVisibilityChange = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        loadData();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  if (isLoading && !data) {
    return (
      <div className="p-8 text-center text-xs font-mono text-gray-400">
        Loading operational metrics...
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-6 bg-red-950 border border-red-800 text-red-200 text-xs font-mono flex flex-col gap-3">
        <span>{error}</span>
        <Button variant="outline" size="sm" onClick={loadData} className="w-fit">
          Retry Connection
        </Button>
      </div>
    );
  }

  const kpis = data?.kpis;
  const queue = data?.queue;
  const recentJobs = data?.recentJobs || [];
  const recentErrors = data?.recentErrors || [];

  return (
    <div className="flex flex-col gap-6">
      {/* Top Banner with Quick Actions & Live Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#121316] border border-[#272a30] p-4">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-emerald-500 inline-block animate-pulse"></div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-white">
              Live Operations Control Center
            </span>
            <p className="text-[11px] font-mono text-gray-400">
              Auto-refreshing &bull; System Status: <span className="text-emerald-400 uppercase font-bold">{data?.systemStatus || "HEALTHY"}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            isLoading={isRefreshing}
            className="flex items-center gap-1.5 font-mono text-[11px]"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Refresh Metrics</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Users */}
        <div className="bg-[#121316] border border-[#272a30] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider">Total Users</span>
            <Users className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-white">{kpis?.totalUsers}</div>
            <div className="text-[10px] font-mono text-emerald-400 mt-0.5">
              {kpis?.activeUsers} Active
            </div>
          </div>
        </div>

        {/* Total Jobs */}
        <div className="bg-[#121316] border border-[#272a30] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider">Total Jobs</span>
            <Video className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-white">{kpis?.totalJobs}</div>
            <div className="text-[10px] font-mono text-amber-400 mt-0.5">
              +{kpis?.jobsToday} Today
            </div>
          </div>
        </div>

        {/* Processing Jobs */}
        <div className="bg-[#121316] border border-[#272a30] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider">Processing</span>
            <Activity className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-amber-400">{kpis?.processingJobs}</div>
            <div className="text-[10px] font-mono text-gray-400 mt-0.5">
              In Queue / Active
            </div>
          </div>
        </div>

        {/* Completed Jobs */}
        <div className="bg-[#121316] border border-[#272a30] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider">Completed</span>
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-emerald-400">{kpis?.completedJobs}</div>
            <div className="text-[10px] font-mono text-gray-400 mt-0.5">
              Success Rate: {kpis?.totalJobs ? Math.round(((kpis.completedJobs || 0) / kpis.totalJobs) * 100) : 100}%
            </div>
          </div>
        </div>

        {/* Total Clips */}
        <div className="bg-[#121316] border border-[#272a30] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider">Total Clips</span>
            <Film className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-white">{kpis?.totalClips}</div>
            <div className="text-[10px] font-mono text-gray-400 mt-0.5">
              Avg {kpis?.avgProcessingTimeSeconds}s per job
            </div>
          </div>
        </div>

        {/* Storage Used */}
        <div className="bg-[#121316] border border-[#272a30] p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-[10px] font-mono uppercase tracking-wider">Storage</span>
            <HardDrive className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-white">{kpis?.storageUsedFormatted}</div>
            <div className="text-[10px] font-mono text-gray-400 mt-0.5">
              Media &amp; Cache
            </div>
          </div>
        </div>
      </div>

      {/* Queue & Worker Status Bar */}
      <div className="bg-[#121316] border border-[#272a30] p-4 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 uppercase">Queue Depth:</span>
            <span className="text-white font-bold">{queue?.depth} Pending</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 uppercase">Active Workers:</span>
            <span className="text-emerald-400 font-bold">{queue?.workersActive} Threads</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 uppercase">Queue Engine:</span>
            <span className="text-white font-bold">{queue?.redisConnected ? "Redis Cluster" : "FastAPI Async Queue"}</span>
          </div>
        </div>

        <Link href="/system" className="text-amber-400 hover:underline flex items-center gap-1 uppercase font-bold text-[11px]">
          System Diagnostics <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Main Split: Recent Jobs (8 cols) & Errors / Health (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Recent Activity Table (8 Cols) */}
        <div className="lg:col-span-8 bg-[#121316] border border-[#272a30] p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#22252c]">
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-amber-500" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                  Recent Video Jobs
                </h2>
              </div>
              <Link href="/jobs" className="text-[11px] font-mono text-amber-400 hover:underline flex items-center gap-1">
                <span>View All Jobs</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {recentJobs.length === 0 ? (
              <div className="py-8 text-center text-xs font-mono text-gray-400">
                No processing jobs found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-[#22252c] text-gray-400 text-[10px] uppercase">
                      <th className="pb-2">Job ID</th>
                      <th className="pb-2">User</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2">Clips</th>
                      <th className="pb-2">Created</th>
                      <th className="pb-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e2026]">
                    {recentJobs.map((job) => (
                      <tr key={job.id} className="hover:bg-[#16181f] transition-colors">
                        <td className="py-2.5 text-white font-bold truncate max-w-[120px]">
                          {job.id}
                        </td>
                        <td className="py-2.5 text-gray-300 truncate max-w-[140px]">
                          {job.userEmail}
                        </td>
                        <td className="py-2.5">
                          <StatusBadge status={job.status} />
                        </td>
                        <td className="py-2.5 text-gray-300">{job.clipCount}</td>
                        <td className="py-2.5 text-gray-400 text-[11px]">
                          {formatTime(job.createdAt)}
                        </td>
                        <td className="py-2.5 text-right">
                          <Link href={`/jobs/${job.id}`}>
                            <button className="px-2 py-1 bg-[#1a1c22] hover:bg-[#252831] border border-[#2c303a] text-gray-300 hover:text-white text-[10px] uppercase transition-colors">
                              Inspect
                            </button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right: Recent Errors & Alerts (4 Cols) */}
        <div className="lg:col-span-4 bg-[#121316] border border-[#272a30] p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#22252c]">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                  Recent Error Feed
                </h2>
              </div>
              <Link href="/audit-logs" className="text-[11px] font-mono text-gray-400 hover:text-white">
                All Logs
              </Link>
            </div>

            {recentErrors.length === 0 ? (
              <div className="py-8 text-center text-xs font-mono text-emerald-400 flex flex-col items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <span>Zero system errors reported.</span>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {recentErrors.map((err, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-[#171315] border border-rose-950/80 flex flex-col gap-1 text-xs"
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className="text-rose-400 font-bold uppercase">{err.service}</span>
                      <span className="text-gray-400">{formatTime(err.timestamp)}</span>
                    </div>
                    <p className="text-gray-200 text-xs font-mono leading-tight line-clamp-2">
                      {err.message}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-[#1e2025] flex items-center justify-between text-[11px] font-mono text-gray-400">
            <span>Failed Job Threshold: &lt; 5%</span>
            <span className="text-emerald-400">Within Spec</span>
          </div>
        </div>
      </div>
    </div>
  );
}
