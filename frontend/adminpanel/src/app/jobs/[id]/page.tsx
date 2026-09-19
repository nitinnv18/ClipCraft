"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { adminApi } from "@/lib/adminApi";
import { AdminJobDetail } from "@/types/admin";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import {
  Video,
  ArrowLeft,
  RotateCcw,
  Ban,
  CheckCircle2,
  Clock,
  Terminal,
  Film,
  ExternalLink,
  Layers,
  Sparkles,
} from "lucide-react";

export default function AdminJobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [data, setData] = useState<AdminJobDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionType, setActionType] = useState<"retry" | "cancel" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadJob = async () => {
    setIsLoading(true);
    try {
      const res = await adminApi.getJobDetail(jobId);
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadJob();
    const interval = setInterval(loadJob, 10000);
    return () => clearInterval(interval);
  }, [jobId]);

  const handleAction = async () => {
    if (!actionType) return;
    setActionLoading(true);
    try {
      if (actionType === "retry") {
        await adminApi.retryJob(jobId);
      } else if (actionType === "cancel") {
        await adminApi.cancelJob(jobId);
      }
      setActionType(null);
      loadJob();
    } catch (err: any) {
      alert(err.message || "Action failed.");
    } finally {
      setActionLoading(false);
    }
  };

  if (isLoading && !data) {
    return (
      <div className="p-12 text-center text-xs font-mono text-gray-400">
        Inspecting job pipeline...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 bg-red-950 border border-red-800 text-red-200 text-xs font-mono">
        Job not found.
      </div>
    );
  }

  const j = data.job;

  return (
    <div className="flex flex-col gap-6">
      {/* Confirm Action Dialog */}
      {actionType && (
        <ConfirmDialog
          isOpen={true}
          title={actionType === "retry" ? `Requeue Job ${jobId}` : `Cancel Job ${jobId}`}
          description={
            actionType === "retry"
              ? "The job will be immediately reset and reassigned to the active processing worker."
              : "Ongoing processing will be terminated and marked as cancelled."
          }
          confirmLabel={actionType === "retry" ? "Requeue" : "Cancel Job"}
          isDestructive={actionType === "cancel"}
          isLoading={actionLoading}
          onConfirm={handleAction}
          onClose={() => setActionType(null)}
        />
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#121316] border border-[#272a30] p-4">
        <div className="flex items-center gap-3">
          <Link href="/jobs">
            <button className="p-2 bg-[#181a1f] hover:bg-[#252831] border border-[#2e323d] text-gray-300">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold uppercase text-white font-mono">{j.title}</h1>
              <StatusBadge status={j.status} />
            </div>
            <span className="text-[10px] font-mono text-gray-400">
              Job ID: {j.id} &bull; User: {j.userEmail}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActionType("retry")}
            className="flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Requeue Job</span>
          </Button>

          {["queued", "processing"].includes(j.status) && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setActionType("cancel")}
              className="flex items-center gap-1.5"
            >
              <Ban className="w-3.5 h-3.5" />
              <span>Cancel Job</span>
            </Button>
          )}
        </div>
      </div>

      {/* Pipeline Stage Inspector (Stepped Flow) */}
      <div className="bg-[#121316] border border-[#272a30] p-5">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#22252c]">
          <span className="text-xs font-bold uppercase tracking-wider text-white font-mono">
            Processing Stage Pipeline
          </span>
          <span className="text-xs font-mono text-amber-400">
            Overall Progress: {j.progress}%
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {data.stages.map((st, idx) => (
            <div
              key={st.key}
              className={`p-2.5 border flex flex-col justify-between text-xs font-mono ${
                st.done
                  ? "bg-[#13241b] border-emerald-800 text-emerald-300"
                  : "bg-[#16181e] border-[#26282f] text-gray-500"
              }`}
            >
              <div className="flex items-center justify-between text-[10px] mb-1">
                <span>0{idx + 1}</span>
                {st.done ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Clock className="w-3 h-3" />}
              </div>
              <span className="font-bold uppercase text-[10px]">{st.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Meta & Logs Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Job Parameters & Settings (5 Cols) */}
        <div className="lg:col-span-5 bg-[#121316] border border-[#272a30] p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-white pb-3 mb-3 border-b border-[#22252c]">
              Job Specifications
            </h2>

            <div className="flex flex-col gap-2.5 text-xs font-mono text-gray-300">
              <div className="flex items-center justify-between py-1 border-b border-[#1c1e24]">
                <span className="text-gray-400">YouTube URL:</span>
                <a href={j.youtubeUrl} target="_blank" className="text-amber-400 hover:underline truncate max-w-[200px]">
                  {j.youtubeUrl}
                </a>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-[#1c1e24]">
                <span className="text-gray-400">Target Clip Count:</span>
                <span className="text-white font-bold">{j.clipCount} Clips</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-[#1c1e24]">
                <span className="text-gray-400">Target Aspect Ratio:</span>
                <span className="text-white font-bold">{j.settings?.format || "9:16 Vertical"}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-[#1c1e24]">
                <span className="text-gray-400">Captions Burned:</span>
                <span className="text-white font-bold">{j.settings?.captions !== false ? "Enabled (High-Contrast)" : "Disabled"}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-[#1c1e24]">
                <span className="text-gray-400">Created At:</span>
                <span className="text-gray-200">{new Date(j.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-[#1c1e24]">
                <span className="text-gray-400">Completed At:</span>
                <span className="text-gray-200">{j.completedAt ? new Date(j.completedAt).toLocaleString() : "—"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Live Event Logs (7 Cols) */}
        <div className="lg:col-span-7 bg-[#121316] border border-[#272a30] p-5">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#22252c]">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-amber-500" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                Job Event Logs
              </h2>
            </div>
            <span className="text-[10px] font-mono text-gray-400">
              {data.logs.length} Events Recorded
            </span>
          </div>

          <div className="p-3 bg-[#0d0e11] border border-[#202228] flex flex-col gap-2 font-mono text-xs max-h-[260px] overflow-y-auto">
            {data.logs.map((log, idx) => (
              <div key={idx} className="flex items-start gap-2.5">
                <span className="text-gray-500 text-[10px] flex-shrink-0 mt-0.5">
                  {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ""}
                </span>
                <span className="text-gray-200">{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Generated Clips Grid */}
      <div className="bg-[#121316] border border-[#272a30] p-5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-white pb-3 mb-4 border-b border-[#22252c]">
          Generated Clips ({data.clips.length})
        </h2>

        {data.clips.length === 0 ? (
          <div className="py-8 text-center text-xs font-mono text-gray-400">
            No clips rendered for this job yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.clips.map((c) => (
              <div key={c.id} className="p-4 bg-[#16181e] border border-[#282b34] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-white uppercase truncate max-w-[180px]">
                      {c.title}
                    </span>
                    <span className="px-2 py-0.5 bg-[#122419] border border-emerald-800 text-emerald-400 text-[10px] font-mono">
                      {c.score}% Match
                    </span>
                  </div>

                  <p className="text-[11px] font-mono text-gray-400 line-clamp-2 mb-3">
                    &ldquo;{c.hook}&rdquo;
                  </p>
                </div>

                <div className="pt-3 border-t border-[#20232b] flex items-center justify-between text-[11px] font-mono text-gray-400">
                  <span>Duration: {c.duration}s</span>
                  {c.videoUrl && (
                    <a href={c.videoUrl} target="_blank" className="text-amber-400 hover:underline flex items-center gap-1">
                      <span>Stream Clip</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
