"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { adminApi } from "@/lib/adminApi";
import { logger } from "@/lib/logger";
import { AdminUserRow } from "@/types/admin";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/utils";
import {
  Users,
  Search,
  UserX,
  UserCheck,
  Trash2,
  Eye,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from "lucide-react";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog State
  const [actionUser, setActionUser] = useState<AdminUserRow | null>(null);
  const [actionType, setActionType] = useState<"suspend" | "unsuspend" | "delete" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [suspensionReason, setSuspensionReason] = useState("");

  const loadUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await adminApi.listUsers({
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        page,
        limit,
      });
      setUsers(res.users);
      setTotal(res.total);
    } catch (err) {
      logger.error("Failed to load users list", err);
      setError(err instanceof Error ? err.message : "Failed to load users list.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [page, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadUsers();
  };

  const handleConfirmAction = async () => {
    if (!actionUser || !actionType) return;
    setActionLoading(true);
    try {
      if (actionType === "suspend") {
        await adminApi.suspendUser(actionUser.id, suspensionReason);
      } else if (actionType === "unsuspend") {
        await adminApi.unsuspendUser(actionUser.id);
      } else if (actionType === "delete") {
        await adminApi.deleteUser(actionUser.id);
      }
      setActionType(null);
      setActionUser(null);
      setSuspensionReason("");
      loadUsers();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to execute action.");
    } finally {
      setActionLoading(false);
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="flex flex-col gap-6">
      {/* Action Dialog */}
      {actionUser && actionType && (
        <ConfirmDialog
          isOpen={true}
          title={
            actionType === "suspend"
              ? `Suspend User ${actionUser.email}`
              : actionType === "unsuspend"
              ? `Unsuspend User ${actionUser.email}`
              : `Permanently Delete User ${actionUser.email}`
          }
          description={
            actionType === "suspend"
              ? "Suspended users will be blocked from creating new processing jobs and logging into the clipper platform."
              : actionType === "unsuspend"
              ? "The user account will be reactivated with standard permissions restored."
              : "CAUTION: This will permanently delete the user account and all associated video jobs and clips. This cannot be undone."
          }
          confirmLabel={
            actionType === "suspend"
              ? "Suspend User"
              : actionType === "unsuspend"
              ? "Unsuspend User"
              : "Delete Permanently"
          }
          requireKeyword={actionType === "delete" ? actionUser.email : undefined}
          isDestructive={actionType !== "unsuspend"}
          isLoading={actionLoading}
          onConfirm={handleConfirmAction}
          onClose={() => {
            setActionType(null);
            setActionUser(null);
            setSuspensionReason("");
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
              placeholder="Search by email or user ID..."
              className="w-full bg-[#181a1f] border border-[#30333d] px-3.5 py-2 text-xs font-mono text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm" className="font-mono text-xs">
            <Search className="w-3.5 h-3.5" />
          </Button>
        </form>

        {/* Filters */}
        <div className="flex items-center gap-3">
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
              <option value="active">Active Only</option>
              <option value="suspended">Suspended Only</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <Button variant="outline" size="sm" onClick={loadUsers} className="font-mono text-xs">
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-[#121316] border border-[#272a30] overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs font-mono text-gray-400">
            Fetching users...
          </div>
        ) : error ? (
          <div className="p-12 text-center text-xs font-mono text-red-400 flex flex-col items-center gap-3">
            <Users className="w-6 h-6 text-red-500" />
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={loadUsers}>
              Retry Connection
            </Button>
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-xs font-mono text-gray-400 flex flex-col items-center gap-2">
            <Users className="w-6 h-6 text-gray-500" />
            <span>No users match your criteria.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-[#22252c] bg-[#15171c] text-gray-400 text-[10px] uppercase">
                  <th className="p-3">User ID</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Jobs</th>
                  <th className="p-3">Clips</th>
                  <th className="p-3">Est. Storage</th>
                  <th className="p-3">Created</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2026]">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-[#16181f] transition-colors">
                    <td className="p-3 text-white font-bold max-w-[120px] truncate">
                      {u.id}
                    </td>
                    <td className="p-3 text-gray-200">{u.email}</td>
                    <td className="p-3">
                      <StatusBadge status={u.status} />
                    </td>
                    <td className="p-3 text-gray-300">{u.jobCount}</td>
                    <td className="p-3 text-gray-300">{u.clipCount}</td>
                    <td className="p-3 text-gray-400">{u.storageMb} MB</td>
                    <td className="p-3 text-gray-400 text-[11px]">
                      {formatDate(u.createdAt)}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link href={`/users/${u.id}`}>
                          <button
                            title="Inspect User Details"
                            className="p-1.5 bg-[#1a1c22] hover:bg-[#252831] border border-[#2c303a] text-gray-300 hover:text-white"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </Link>

                        {u.status === "suspended" ? (
                          <button
                            onClick={() => {
                              setActionUser(u);
                              setActionType("unsuspend");
                            }}
                            title="Unsuspend User"
                            className="p-1.5 bg-[#122419] hover:bg-[#193322] border border-emerald-800 text-emerald-400"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setActionUser(u);
                              setActionType("suspend");
                            }}
                            title="Suspend User"
                            className="p-1.5 bg-[#251518] hover:bg-[#381a1f] border border-rose-900 text-rose-400"
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setActionUser(u);
                            setActionType("delete");
                          }}
                          title="Delete User"
                          className="p-1.5 bg-[#1a1c22] hover:bg-rose-950 border border-[#2c303a] hover:border-rose-800 text-gray-400 hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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
            Showing {users.length} of {total} registered users
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
