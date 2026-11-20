"use client";

import React, { useEffect, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import { logger } from "@/lib/logger";
import { AuditLogEntry } from "@/types/admin";
import { Button } from "@/components/ui/Button";
import { formatDateTime } from "@/lib/utils";
import {
  ShieldAlert,
  RefreshCw,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export default function AdminAuditLogsPage() {
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [actionFilter, setActionFilter] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAuditLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await adminApi.getAuditLogs({
        action: actionFilter || undefined,
        page,
        limit,
      });
      setAuditLogs(res.auditLogs);
      const logTotal = res.total ?? res.count;
      setTotal(logTotal);
      setTotalPages(res.pages ?? Math.max(1, Math.ceil(logTotal / limit)));
    } catch (err) {
      logger.error("Failed to load audit logs", err);
      setError(err instanceof Error ? err.message : "Failed to load audit logs.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, [actionFilter, page]);

  const handleActionFilterChange = (newAction: string) => {
    setActionFilter(newAction);
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#121316] border border-[#272a30] p-4">
        <div>
          <h1 className="text-sm font-bold uppercase text-white font-mono">
            Administrative Audit Trail
          </h1>
          <p className="text-[11px] font-mono text-gray-400">
            Immutable log of sensitive administrator actions, suspensions, deletions, retries, and configuration changes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={actionFilter}
              onChange={(e) => handleActionFilterChange(e.target.value)}
              className="bg-[#181a1f] border border-[#30333d] pl-3 pr-8 py-2 text-xs font-mono uppercase text-gray-200 focus:outline-none focus:border-amber-500 appearance-none cursor-pointer"
            >
              <option value="">All Audit Actions</option>
              <option value="ADMIN_LOGIN">ADMIN_LOGIN</option>
              <option value="USER_SUSPENDED">USER_SUSPENDED</option>
              <option value="USER_UNSUSPENDED">USER_UNSUSPENDED</option>
              <option value="USER_DELETED">USER_DELETED</option>
              <option value="JOB_RETRIED">JOB_RETRIED</option>
              <option value="JOB_CANCELLED">JOB_CANCELLED</option>
              <option value="CLIP_DELETED">CLIP_DELETED</option>
              <option value="STORAGE_CLEANUP">STORAGE_CLEANUP</option>
              <option value="SETTINGS_UPDATED">SETTINGS_UPDATED</option>
              <option value="ADMIN_CREATED">ADMIN_CREATED</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <Button variant="outline" size="sm" onClick={loadAuditLogs} className="font-mono text-xs">
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-[#121316] border border-[#272a30] overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs font-mono text-gray-400">
            Fetching audit records...
          </div>
        ) : error ? (
          <div className="p-12 text-center text-xs font-mono text-red-400 flex flex-col items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-red-500" />
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={loadAuditLogs}>
              Retry Connection
            </Button>
          </div>
        ) : auditLogs.length === 0 ? (
          <div className="p-12 text-center text-xs font-mono text-gray-400 flex flex-col items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-gray-500" />
            <span>No audit events recorded yet.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-[#22252c] bg-[#15171c] text-gray-400 text-[10px] uppercase">
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Admin</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Target</th>
                  <th className="p-3">Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2026]">
                {auditLogs.map((a) => (
                  <tr key={a.id} className="hover:bg-[#16181f] transition-colors">
                    <td className="p-3 text-gray-400 text-[11px] whitespace-nowrap">
                      {formatDateTime(a.createdAt)}
                    </td>
                    <td className="p-3 text-amber-400 font-bold">{a.adminEmail}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-[#181a20] border border-[#2a2d37] text-white font-bold text-[10px] uppercase">
                        {a.action}
                      </span>
                    </td>
                    <td className="p-3 text-gray-300">
                      <span className="text-gray-400 uppercase text-[10px]">{a.targetType}:</span>{" "}
                      <span className="text-white">{a.targetId || "—"}</span>
                    </td>
                    <td className="p-3 text-gray-400 text-[11px] truncate max-w-[240px]" title={JSON.stringify(a.metadata)}>
                      {Object.keys(a.metadata || {}).length > 0
                        ? JSON.stringify(a.metadata)
                        : "—"}
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
            Showing {auditLogs.length} of {total} audit records
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
              className="px-2.5 py-1 bg-[#181a1f] border border-[#2c303a] hover:bg-[#232730] text-gray-200 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-white font-bold">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
              className="px-2.5 py-1 bg-[#181a1f] border border-[#2c303a] hover:bg-[#232730] text-gray-200 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
