import { AuthResponse, User, VideoJob, Clip } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

class ApiClient {
  private getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("clipcraft_token");
  }

  setToken(token: string) {
    if (typeof window !== "undefined") {
      localStorage.setItem("clipcraft_token", token);
    }
  }

  clearToken() {
    if (typeof window !== "undefined") {
      localStorage.removeItem("clipcraft_token");
      localStorage.removeItem("clipcraft_user");
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

  // Health
  async getHealth() {
    return this.request<{ status: string }>("/health");
  }

  // Auth
  async register(email: string, password: string): Promise<AuthResponse> {
    return this.request<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    return this.request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  async getMe(): Promise<User> {
    return this.request<User>("/api/auth/me");
  }

  // Jobs
  async createJob(params: {
    youtubeUrl: string;
    clipCount?: number;
    minDuration?: number;
    maxDuration?: number;
    format?: string;
    captions?: boolean;
    saveToCloud?: boolean;
  }): Promise<VideoJob> {
    return this.request<VideoJob>("/api/jobs", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async createUploadJob(formData: FormData): Promise<VideoJob> {
    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const url = `${API_BASE}/api/jobs/upload`;
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({ detail: "Video upload failed" }));
      throw new Error(errorBody.detail || `Upload failed with status ${res.status}`);
    }

    return res.json();
  }

  async listJobs(): Promise<VideoJob[]> {
    return this.request<VideoJob[]>("/api/jobs");
  }

  async getJob(jobId: string): Promise<VideoJob> {
    return this.request<VideoJob>(`/api/jobs/${jobId}`);
  }

  async getJobClips(jobId: string): Promise<Clip[]> {
    return this.request<Clip[]>(`/api/jobs/${jobId}/clips`);
  }

  async deleteJob(jobId: string): Promise<{ status: string; jobId: string }> {
    return this.request<{ status: string; jobId: string }>(`/api/jobs/${jobId}`, {
      method: "DELETE",
    });
  }
}

export const api = new ApiClient();
