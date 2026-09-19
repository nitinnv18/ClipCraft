"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { adminApi } from "@/lib/adminApi";
import { AdminUserDetail } from "@/types/admin";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import {
  User,
  Video,
  Film,
  HardDrive,
  ArrowLeft,
  UserX,
  UserCheck,
  Trash2,
  Calendar,
  Clock,
  ExternalLink,
} from "lucide-react";

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [data, setData] = useState<AdminUserDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionType, setActionType] = useState<"suspend" | "unsuspend" | "delete" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadUser = async () => {
    setIsLoading(true);
    try {
      const res = await adminApi.getUserDetail(userId);
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, [userId]);

  const handleAction = async () => {
    if (!actionType || !data) return;
    setActionLoading(true);
    try {
      if (actionType === "suspend") {
        await adminApi.suspendUser(userId, "Admin manual suspension");
      } else if (actionType === "unsuspend") {
        await adminApi.unsuspendUser(userId);
      } else if (actionType === "delete") {
        await adminApi.deleteUser(userId);
        router.push("/users");
        return;
      }
      setActionType(null);
      loadUser();
    } catch (err: any) {
      alert(err.message || "Failed to execute action.");
    } finally {
      setActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-xs font-mono text-gray-400">
        Loading user profile...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 bg-red-950 border border-red-800 text-red-200 text-xs font-mono">
        User not found.
      </div>
    );
  }

  const u = data.user;
  const usage = data.usage;

  return (
    <div className="flex flex-col gap-6">
      {/* Confirm Dialog */}
      {actionType && (
        <ConfirmDialog
          isOpen={true}
          title={
            actionType === "suspend"
              ? `Suspend User ${u.email}`
              : actionType === "unsuspend"
              ? `Unsuspend User ${u.email}`
              : `Permanently Delete User ${u.email}`
          }
          description={
            actionType === "delete"
              ? "All video jobs and clips will be permanently removed."
              : "User permissions will be adjusted immediately."
          }
          requireKeyword={actionType === "delete" ? u.email : undefined}
          isDestructive={actionType !== "unsuspend"}
          isLoading={actionLoading}
          onConfirm={handleAction}
          onClose={() => setActionType(null)}
        />
      )}

      {/* Back button & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#121316] border border-[#272a30] p-4">
        <div className="flex items-center gap-3">
          <Link href="/users">
            <button className="p-2 bg-[#181a1f] hover:bg-[#252831] border border-[#2e323d] text-gray-300">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold uppercase text-white font-mono">{u.email}</h1>
              <StatusBadge status={u.status} />
            </div>
            <span className="text-[10px] font-mono text-gray-400">ID: {u.id}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {u.status === "suspended" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActionType("unsuspend")}
              className="border-emerald-800 text-emerald-400 hover:bg-emerald-950/40"
            >
              <UserCheck className="w-3.5 h-3.5 mr-1" />
              <span>Unsuspend User</span>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActionType("suspend")}
              className="border-rose-900 text-rose-400 hover:bg-rose-950/40"
            >
              <UserX className="w-3.5 h-3.5 mr-1" />
              <span>Suspend Account</span>
            </Button>
          )}

          <Button
            variant="danger"
            size="sm"
            onClick={() => setActionType("delete")}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            <span>Delete User</span>
          </Button>
        </div>
      </div>

      {/* Suspension Alert if active */}
      {u.status === "suspended" && (
        <div className="p-4 bg-rose-950/40 border border-rose-800 text-rose-200 text-xs font-mono flex flex-col gap-1">
          <span className="font-bold uppercase">Account Suspended</span>
          <span>Reason: {u.suspensionReason || "Admin policy"}</span>
          <span className="text-rose-400 text-[10px]">
            Suspended by {u.suspendedBy} on {u.suspendedAt ? new Date(u.suspendedAt).toLocaleString() : ""}
          </span>
        </div>
      )}

      {/* Usage Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#121316] border border-[#272a30] p-4">
          <div className="text-[10px] font-mono uppercase text-gray-400 mb-1">Total Jobs</div>
          <div className="text-xl font-bold font-mono text-white">{usage.totalJobs}</div>
        </div>
        <div className="bg-[#121316] border border-[#272a30] p-4">
          <div className="text-[10px] font-mono uppercase text-gray-400 mb-1">Completed</div>
          <div className="text-xl font-bold font-mono text-emerald-400">{usage.completedJobs}</div>
        </div>
        <div className="bg-[#121316] border border-[#272a30] p-4">
          <div className="text-[10px] font-mono uppercase text-gray-400 mb-1">Total Clips</div>
          <div className="text-xl font-bold font-mono text-amber-400">{usage.totalClips}</div>
        </div>
        <div className="bg-[#121316] border border-[#272a30] p-4">
          <div className="text-[10px] font-mono uppercase text-gray-400 mb-1">Estimated Storage</div>
          <div className="text-xl font-bold font-mono text-white">{usage.storageMb} MB</div>
        </div>
      </div>

      {/* Split: User's Recent Jobs & Recent Clips */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Jobs */}
        <div className="bg-[#121316] border border-[#272a30] p-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-white pb-3 mb-3 border-b border-[#22252c]">
            Recent Video Jobs ({data.recentJobs.length})
          </h2>
          {data.recentJobs.length === 0 ? (
            <div className="py-6 text-center text-xs font-mono text-gray-400">No jobs submitted yet.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {data.recentJobs.map((j) => (
                <div key={j.id} className="p-3 bg-[#16181f] border border-[#26282f] flex items-center justify-between text-xs font-mono">
                  <div>
                    <div className="text-white font-bold truncate max-w-[240px]">{j.title}</div>
                    <div className="text-[10px] text-gray-400">{new Date(j.createdAt).toLocaleDateString()} &bull; {j.clipCount} Clips</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={j.status} />
                    <Link href={`/jobs/${j.id}`}>
                      <button className="p-1 bg-[#1a1c22] border border-[#2e313b] text-gray-300 hover:text-white">
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* User Clips */}
        <div className="bg-[#121316] border border-[#272a30] p-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-white pb-3 mb-3 border-b border-[#22252c]">
            Generated Clips ({data.recentClips.length})
          </h2>
          {data.recentClips.length === 0 ? (
            <div className="py-6 text-center text-xs font-mono text-gray-400">No clips rendered yet.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {data.recentClips.map((c) => (
                <div key={c.id} className="p-3 bg-[#16181f] border border-[#26282f] flex items-center justify-between text-xs font-mono">
                  <div>
                    <div className="text-white font-bold truncate max-w-[240px]">{c.title}</div>
                    <div className="text-[10px] text-gray-400">{c.duration}s &bull; Match {c.score}%</div>
                  </div>
                  <span className="px-2 py-0.5 bg-[#122419] border border-emerald-800 text-emerald-400 text-[10px]">
                    Ready
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
