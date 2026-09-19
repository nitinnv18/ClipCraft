import {
  AdminAuthResponse,
  AdminUser,
  AdminDashboardData,
  AdminUserRow,
  AdminUserDetail,
  AdminJobRow,
  AdminJobDetail,
  AdminClipRow,
  AdminStorageData,
  SystemHealthData,
  SystemLogEntry,
  AuditLogEntry,
  SystemSettingsData,
} from "@/types/admin";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

class AdminApiClient {
  private getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("clipcraft_admin_token");
  }

  setToken(token: string) {
    if (typeof window !== "undefined") {
      localStorage.setItem("clipcraft_admin_token", token);
    }
  }

  clearToken() {
    if (typeof window !== "undefined") {
      localStorage.removeItem("clipcraft_admin_token");
      localStorage.removeItem("clipcraft_admin_user");
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const url = `${API_BASE}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
    const res = await fetch(url, { ...options, headers });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({ detail: "An unexpected error occurred" }));
      throw new Error(errorBody.detail || `Request failed with status ${res.status}`);
    }

    return res.json();
  }

  // --- Auth ---
  async login(email: string, password: string): Promise<AdminAuthResponse> {
    return this.request<AdminAuthResponse>("/api/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  async getMe(): Promise<AdminUser> {
    return this.request<AdminUser>("/api/admin/auth/me");
  }

  async logout(): Promise<{ message: string }> {
    try {
      return await this.request<{ message: string }>("/api/admin/auth/logout", { method: "POST" });
    } finally {
      this.clearToken();
    }
  }

  // --- Dashboard ---
  async getDashboard(): Promise<AdminDashboardData> {
    return this.request<AdminDashboardData>("/api/admin/dashboard");
  }

  // --- Users ---
  async listUsers(params?: { search?: string; status?: string; page?: number; limit?: number }): Promise<{
    users: AdminUserRow[];
    total: number;
    page: number;
    limit: number;
    pages: number;
  }> {
    const q = new URLSearchParams();
    if (params?.search) q.set("search", params.search);
    if (params?.status) q.set("status", params.status);
    if (params?.page) q.set("page", params.page.toString());
    if (params?.limit) q.set("limit", params.limit.toString());
    return this.request(`/api/admin/users?${q.toString()}`);
  }

  async getUserDetail(userId: string): Promise<AdminUserDetail> {
    return this.request<AdminUserDetail>(`/api/admin/users/${userId}`);
  }

  async suspendUser(userId: string, reason?: string): Promise<{ message: string }> {
    return this.request(`/api/admin/users/${userId}/suspend`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  }

  async unsuspendUser(userId: string): Promise<{ message: string }> {
    return this.request(`/api/admin/users/${userId}/unsuspend`, {
      method: "POST",
    });
  }

  async deleteUser(userId: string): Promise<{ message: string }> {
    return this.request(`/api/admin/users/${userId}`, {
      method: "DELETE",
    });
  }

  // --- Jobs ---
  async listJobs(params?: { search?: string; status?: string; stage?: string; page?: number; limit?: number }): Promise<{
    jobs: AdminJobRow[];
    total: number;
    page: number;
    limit: number;
    pages: number;
  }> {
    const q = new URLSearchParams();
    if (params?.search) q.set("search", params.search);
    if (params?.status) q.set("status", params.status);
    if (params?.stage) q.set("stage", params.stage);
    if (params?.page) q.set("page", params.page.toString());
    if (params?.limit) q.set("limit", params.limit.toString());
    return this.request(`/api/admin/jobs?${q.toString()}`);
  }

  async getJobDetail(jobId: string): Promise<AdminJobDetail> {
    return this.request<AdminJobDetail>(`/api/admin/jobs/${jobId}`);
  }

  async retryJob(jobId: string): Promise<{ message: string }> {
    return this.request(`/api/admin/jobs/${jobId}/retry`, {
      method: "POST",
    });
  }

  async cancelJob(jobId: string): Promise<{ message: string }> {
    return this.request(`/api/admin/jobs/${jobId}/cancel`, {
      method: "POST",
    });
  }

  // --- Clips ---
  async listClips(params?: { search?: string; minScore?: number; page?: number; limit?: number }): Promise<{
    clips: AdminClipRow[];
    total: number;
    page: number;
    limit: number;
    pages: number;
  }> {
    const q = new URLSearchParams();
    if (params?.search) q.set("search", params.search);
    if (params?.minScore) q.set("min_score", params.minScore.toString());
    if (params?.page) q.set("page", params.page.toString());
    if (params?.limit) q.set("limit", params.limit.toString());
    return this.request(`/api/admin/clips?${q.toString()}`);
  }

  async deleteClip(clipId: string): Promise<{ message: string }> {
    return this.request(`/api/admin/clips/${clipId}`, {
      method: "DELETE",
    });
  }

  // --- Storage ---
  async getStorage(): Promise<AdminStorageData> {
    return this.request<AdminStorageData>("/api/admin/storage");
  }

  async triggerCleanup(category: string = "all"): Promise<{ message: string; cleanedFormatted: string }> {
    return this.request("/api/admin/storage/cleanup", {
      method: "POST",
      body: JSON.stringify({ category }),
    });
  }

  // --- System Health ---
  async getSystemHealth(): Promise<SystemHealthData> {
    return this.request<SystemHealthData>("/api/admin/system");
  }

  // --- Logs ---
  async getSystemLogs(params?: { level?: string; service?: string; search?: string; limit?: number }): Promise<{
    logs: SystemLogEntry[];
    count: number;
  }> {
    const q = new URLSearchParams();
    if (params?.level) q.set("level", params.level);
    if (params?.service) q.set("service", params.service);
    if (params?.search) q.set("search", params.search);
    if (params?.limit) q.set("limit", params.limit.toString());
    return this.request(`/api/admin/logs/system?${q.toString()}`);
  }

  async getAuditLogs(params?: { action?: string; limit?: number }): Promise<{
    auditLogs: AuditLogEntry[];
    count: number;
  }> {
    const q = new URLSearchParams();
    if (params?.action) q.set("action", params.action);
    if (params?.limit) q.set("limit", params.limit.toString());
    return this.request(`/api/admin/logs/audit?${q.toString()}`);
  }

  // --- Settings & Admins ---
  async getSettings(): Promise<SystemSettingsData> {
    return this.request<SystemSettingsData>("/api/admin/settings");
  }

  async updateSettings(updates: Partial<SystemSettingsData>): Promise<SystemSettingsData> {
    return this.request<SystemSettingsData>("/api/admin/settings", {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  }

  async listAdmins(): Promise<AdminUser[]> {
    return this.request<AdminUser[]>("/api/admin/settings/admins");
  }

  async createAdmin(params: { email: string; password: string; name?: string; role: string }): Promise<AdminUser> {
    return this.request<AdminUser>("/api/admin/settings/admins", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async updateAdmin(adminId: string, updates: { role?: string; status?: string; name?: string }): Promise<AdminUser> {
    return this.request<AdminUser>(`/api/admin/settings/admins/${adminId}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  }
}

export const adminApi = new AdminApiClient();
