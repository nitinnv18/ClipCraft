"use client";

import React, { useEffect, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import { SystemSettingsData, AdminUser, AdminRole } from "@/types/admin";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Settings,
  Shield,
  Users,
  HardDrive,
  Cpu,
  Save,
  CheckCircle2,
  AlertTriangle,
  UserPlus,
} from "lucide-react";

export default function AdminSettingsPage() {
  const { admin } = useAdminAuth();
  const isSuperAdmin = admin?.role === "SUPER_ADMIN";

  const [settings, setSettings] = useState<SystemSettingsData | null>(null);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [activeTab, setActiveTab] = useState<"general" | "limits" | "processing" | "admins">("general");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // New Admin Form Modal
  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [newAdminRole, setNewAdminRole] = useState<AdminRole>("ADMIN");
  const [createAdminLoading, setCreateAdminLoading] = useState(false);

  const loadData = async () => {
    try {
      const s = await adminApi.getSettings();
      setSettings(s);
      if (isSuperAdmin) {
        const a = await adminApi.listAdmins();
        setAdmins(a);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, [isSuperAdmin]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const updated = await adminApi.updateSettings(settings);
      setSettings(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      alert(err.message || "Failed to update settings.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateAdminLoading(true);
    try {
      await adminApi.createAdmin({
        email: newAdminEmail,
        password: newAdminPassword,
        role: newAdminRole,
      });
      setShowCreateAdmin(false);
      setNewAdminEmail("");
      setNewAdminPassword("");
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to create administrator.");
    } finally {
      setCreateAdminLoading(false);
    }
  };

  if (!settings) {
    return <div className="p-12 text-center text-xs font-mono text-gray-400">Loading settings...</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#121316] border border-[#272a30] p-4">
        <div>
          <h1 className="text-sm font-bold uppercase text-white font-mono">
            System Settings &amp; Access Control
          </h1>
          <p className="text-[11px] font-mono text-gray-400">
            Configure system operational parameters, concurrency limits, maintenance mode, and administrator roles.
          </p>
        </div>

        {saveSuccess && (
          <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-400 bg-[#122419] border border-emerald-800 px-3 py-1.5">
            <CheckCircle2 className="w-4 h-4" />
            <span>Settings saved successfully</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#24272e] pb-2 font-mono text-xs uppercase">
        <button
          onClick={() => setActiveTab("general")}
          className={`px-4 py-2 border transition-colors ${
            activeTab === "general"
              ? "bg-red-600 text-white font-bold border-red-600"
              : "bg-[#121316] text-gray-400 border-[#272a30] hover:text-white"
          }`}
        >
          General &amp; Maintenance
        </button>
        <button
          onClick={() => setActiveTab("limits")}
          className={`px-4 py-2 border transition-colors ${
            activeTab === "limits"
              ? "bg-red-600 text-white font-bold border-red-600"
              : "bg-[#121316] text-gray-400 border-[#272a30] hover:text-white"
          }`}
        >
          Usage Limits
        </button>
        <button
          onClick={() => setActiveTab("processing")}
          className={`px-4 py-2 border transition-colors ${
            activeTab === "processing"
              ? "bg-red-600 text-white font-bold border-red-600"
              : "bg-[#121316] text-gray-400 border-[#272a30] hover:text-white"
          }`}
        >
          Worker &amp; Concurrency
        </button>
        {isSuperAdmin && (
          <button
            onClick={() => setActiveTab("admins")}
            className={`px-4 py-2 border transition-colors ${
              activeTab === "admins"
                ? "bg-red-600 text-white font-bold border-red-600"
                : "bg-[#121316] text-gray-400 border-[#272a30] hover:text-white"
            }`}
          >
            Administrators ({admins.length})
          </button>
        )}
      </div>

      {/* TAB CONTENT: General */}
      {activeTab === "general" && (
        <form onSubmit={handleSaveSettings} className="bg-[#121316] border border-[#272a30] p-6 flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-mono uppercase text-gray-300 font-bold">Product Name</label>
            <input
              type="text"
              value={settings.projectName}
              onChange={(e) => setSettings({ ...settings, projectName: e.target.value })}
              className="bg-[#181a1f] border border-[#30333d] px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-mono uppercase text-gray-300 font-bold">Support Email</label>
            <input
              type="email"
              value={settings.supportEmail}
              onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
              className="bg-[#181a1f] border border-[#30333d] px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="p-4 bg-[#181617] border border-[#352528] flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase text-white font-mono flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>Maintenance Mode</span>
              </div>
              <p className="text-[11px] font-mono text-gray-400 mt-0.5">
                When enabled, normal user clipping is paused with a maintenance notification. Admin console remains active.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSettings({ ...settings, maintenanceMode: !settings.maintenanceMode })}
              className={`px-4 py-2 text-xs font-mono font-bold uppercase border transition-colors ${
                settings.maintenanceMode
                  ? "bg-rose-600 text-white border-rose-600"
                  : "bg-[#181a1f] text-gray-400 border-[#30333d]"
              }`}
            >
              {settings.maintenanceMode ? "ENABLED (ACTIVE)" : "DISABLED"}
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-mono uppercase text-gray-300 font-bold">Maintenance Notice Message</label>
            <input
              type="text"
              value={settings.maintenanceMessage}
              onChange={(e) => setSettings({ ...settings, maintenanceMessage: e.target.value })}
              className="bg-[#181a1f] border border-[#30333d] px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <Button type="submit" variant="primary" size="md" isLoading={isSaving} className="w-fit font-bold flex items-center gap-2 mt-2">
            <Save className="w-4 h-4" />
            <span>Save Configuration</span>
          </Button>
        </form>
      )}

      {/* TAB CONTENT: Usage Limits */}
      {activeTab === "limits" && (
        <form onSubmit={handleSaveSettings} className="bg-[#121316] border border-[#272a30] p-6 flex flex-col gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono uppercase text-gray-300 font-bold">Free Tier Daily Jobs Limit</label>
              <input
                type="number"
                value={settings.freeTierDailyLimit}
                onChange={(e) => setSettings({ ...settings, freeTierDailyLimit: Number(e.target.value) })}
                className="bg-[#181a1f] border border-[#30333d] px-3 py-2 text-xs font-mono text-white"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono uppercase text-gray-300 font-bold">Max Clips Per Video Job</label>
              <input
                type="number"
                value={settings.maxClipsPerJob}
                onChange={(e) => setSettings({ ...settings, maxClipsPerJob: Number(e.target.value) })}
                className="bg-[#181a1f] border border-[#30333d] px-3 py-2 text-xs font-mono text-white"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono uppercase text-gray-300 font-bold">Max Video Length (Seconds)</label>
              <input
                type="number"
                value={settings.maxVideoDurationSeconds}
                onChange={(e) => setSettings({ ...settings, maxVideoDurationSeconds: Number(e.target.value) })}
                className="bg-[#181a1f] border border-[#30333d] px-3 py-2 text-xs font-mono text-white"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono uppercase text-gray-300 font-bold">Storage Retention (Days)</label>
              <input
                type="number"
                value={settings.retentionDays}
                onChange={(e) => setSettings({ ...settings, retentionDays: Number(e.target.value) })}
                className="bg-[#181a1f] border border-[#30333d] px-3 py-2 text-xs font-mono text-white"
              />
            </div>
          </div>

          <Button type="submit" variant="primary" size="md" isLoading={isSaving} className="w-fit font-bold flex items-center gap-2 mt-2">
            <Save className="w-4 h-4" />
            <span>Save Usage Limits</span>
          </Button>
        </form>
      )}

      {/* TAB CONTENT: Processing & Workers */}
      {activeTab === "processing" && (
        <form onSubmit={handleSaveSettings} className="bg-[#121316] border border-[#272a30] p-6 flex flex-col gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono uppercase text-gray-300 font-bold">Max Concurrent Worker Threads</label>
              <input
                type="number"
                value={settings.maxConcurrentWorkers}
                onChange={(e) => setSettings({ ...settings, maxConcurrentWorkers: Number(e.target.value) })}
                className="bg-[#181a1f] border border-[#30333d] px-3 py-2 text-xs font-mono text-white"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono uppercase text-gray-300 font-bold">Job Timeout (Seconds)</label>
              <input
                type="number"
                value={settings.jobTimeoutSeconds}
                onChange={(e) => setSettings({ ...settings, jobTimeoutSeconds: Number(e.target.value) })}
                className="bg-[#181a1f] border border-[#30333d] px-3 py-2 text-xs font-mono text-white"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono uppercase text-gray-300 font-bold">Max Overlap Deduplication (%)</label>
              <input
                type="number"
                value={settings.overlapDeduplicationThreshold}
                onChange={(e) => setSettings({ ...settings, overlapDeduplicationThreshold: Number(e.target.value) })}
                className="bg-[#181a1f] border border-[#30333d] px-3 py-2 text-xs font-mono text-white"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono uppercase text-gray-300 font-bold">Sentence Snap Boundary (Seconds)</label>
              <input
                type="number"
                step="0.5"
                value={settings.sentenceSnapBoundarySeconds}
                onChange={(e) => setSettings({ ...settings, sentenceSnapBoundarySeconds: Number(e.target.value) })}
                className="bg-[#181a1f] border border-[#30333d] px-3 py-2 text-xs font-mono text-white"
              />
            </div>
          </div>

          <Button type="submit" variant="primary" size="md" isLoading={isSaving} className="w-fit font-bold flex items-center gap-2 mt-2">
            <Save className="w-4 h-4" />
            <span>Save Processing Parameters</span>
          </Button>
        </form>
      )}

      {/* TAB CONTENT: Administrators (Super Admin only) */}
      {activeTab === "admins" && isSuperAdmin && (
        <div className="bg-[#121316] border border-[#272a30] p-6 flex flex-col gap-6">
          <div className="flex items-center justify-between pb-3 border-b border-[#22252c]">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
                Administrator Accounts
              </h2>
              <p className="text-[11px] font-mono text-gray-400">
                Manage backend team roles (Super Admin, Admin, Support).
              </p>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowCreateAdmin(true)}
              className="flex items-center gap-1.5 font-bold"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Create Administrator</span>
            </Button>
          </div>

          {/* Create Admin Modal */}
          {showCreateAdmin && (
            <div className="p-4 bg-[#181a1f] border border-[#30333d] flex flex-col gap-4">
              <h3 className="text-xs font-bold uppercase text-white font-mono">
                Add New Administrator
              </h3>
              <form onSubmit={handleCreateAdmin} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="email"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="admin@studio.com"
                  className="bg-[#121316] border border-[#30333d] px-3 py-2 text-xs font-mono text-white"
                  required
                />
                <input
                  type="password"
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  placeholder="Password (min 8 chars)"
                  className="bg-[#121316] border border-[#30333d] px-3 py-2 text-xs font-mono text-white"
                  required
                />
                <select
                  value={newAdminRole}
                  onChange={(e) => setNewAdminRole(e.target.value as any)}
                  className="bg-[#121316] border border-[#30333d] px-3 py-2 text-xs font-mono uppercase text-white"
                >
                  <option value="ADMIN">ADMIN</option>
                  <option value="SUPPORT">SUPPORT</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                </select>

                <div className="sm:col-span-3 flex items-center justify-end gap-2 pt-2">
                  <Button variant="outline" size="sm" type="button" onClick={() => setShowCreateAdmin(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" type="submit" isLoading={createAdminLoading}>
                    Create Account
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Admins Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-[#22252c] text-gray-400 text-[10px] uppercase">
                  <th className="pb-2">Email</th>
                  <th className="pb-2">Role</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Created</th>
                  <th className="pb-2">Last Login</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2026]">
                {admins.map((a) => (
                  <tr key={a.id} className="hover:bg-[#16181f]">
                    <td className="py-2.5 text-white font-bold">{a.email}</td>
                    <td className="py-2.5">
                      <StatusBadge status={a.role} />
                    </td>
                    <td className="py-2.5">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="py-2.5 text-gray-400 text-[11px]">
                      {new Date(a.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 text-gray-400 text-[11px]">
                      {a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
