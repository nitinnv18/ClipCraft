import { AuthResponse, User, VideoJob, Clip, PlannedClip, VideoPlanResponse } from "@/types";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/+$/, "");

class ApiClient {
  private getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("clipcraft_token");
  }

  getUser(): User | null {
    if (typeof window === "undefined") return null;
    const str = localStorage.getItem("clipcraft_user");
    if (!str) return null;
    try {
      return JSON.parse(str);
    } catch (_) {
      return null;
    }
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
      let errorMsg = `Request failed with status ${res.status}`;
      if (typeof errorBody.detail === "string") {
        errorMsg = errorBody.detail;
      } else if (Array.isArray(errorBody.detail)) {
        errorMsg = errorBody.detail.map((err: { msg?: string }) => err.msg || JSON.stringify(err)).join(", ");
      } else if (errorBody.message) {
        errorMsg = errorBody.message;
      }
      throw new Error(errorMsg);
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
  async getPlan(params: {
    duration: number;
    title?: string;
    clipCount?: number;
    minDuration?: number;
    maxDuration?: number;
  }): Promise<VideoPlanResponse> {
    return this.request<VideoPlanResponse>("/api/jobs/plan", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async getPlanWithAudio(
    audioBlob: Blob,
    params: {
      duration: number;
      title?: string;
      clipCount?: number;
      minDuration?: number;
      maxDuration?: number;
      language?: string;
    }
  ): Promise<VideoPlanResponse> {
    const formData = new FormData();
    const ext = audioBlob.type.includes("mp4") ? "audio_track.m4a" : "audio_track.mp3";
    formData.append("file", audioBlob, ext);
    formData.append("title", params.title || "Video");
    formData.append("duration", String(params.duration));
    formData.append("clipCount", String(params.clipCount || 5));
    formData.append("minDuration", String(params.minDuration || 30));
    formData.append("maxDuration", String(params.maxDuration || 60));
    if (params.language) {
      formData.append("language", params.language);
    }

    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}/api/jobs/plan-audio`, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!res.ok) {
      throw new Error(`Failed to generate plan with audio: ${res.statusText}`);
    }

    return res.json();
  }

  async syncClientJob(payload: {
    id?: string;
    title: string;
    duration: number;
    clipCount: number;
    format?: string;
    status?: "processing" | "completed" | "failed";
    progress?: number;
    error?: string;
    clips: (PlannedClip | Clip)[];
    userId?: string;
    userEmail?: string;
  }): Promise<VideoJob> {
    const user = this.getUser();
    const bodyPayload = {
      ...payload,
      userId: payload.userId || user?.id,
      userEmail: payload.userEmail || user?.email,
    };
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        return await this.request<VideoJob>("/api/jobs/client-sync", {
          method: "POST",
          body: JSON.stringify(bodyPayload),
        });
      } catch (err) {
        if (attempt === 2) throw err;
        await new Promise((r) => setTimeout(r, 400));
      }
    }
    throw new Error("Failed to sync client job");
  }

  async listJobs(): Promise<VideoJob[]> {
    return this.request<VideoJob[]>("/api/jobs");
  }

  async getJob(jobId: string): Promise<VideoJob> {
    return this.request<VideoJob>(`/api/jobs/${jobId}`);
  }

  async deleteJob(jobId: string): Promise<{ status: string; jobId: string }> {
    return this.request<{ status: string; jobId: string }>(`/api/jobs/${jobId}`, {
      method: "DELETE",
    });
  }
}

export const api = new ApiClient();
