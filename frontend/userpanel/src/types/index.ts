export interface User {
  id: string;
  email: string;
  createdAt: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export type JobStatus = "queued" | "processing" | "completed" | "failed" | "cancelled";
export type JobStage =
  | "initializing"
  | "fetching"
  | "transcribing"
  | "analyzing"
  | "selecting"
  | "rendering"
  | "uploading"
  | "finalizing"
  | "completed";

export interface JobSettings {
  clipCount: number;
  minDuration: number;
  maxDuration: number;
  format: string;
  captions?: boolean;
  saveToCloud?: boolean;
}

export interface Clip {
  id: string;
  jobId: string;
  userId?: string;
  startTime: number;
  endTime: number;
  duration: number;
  title: string;
  hook?: string;
  description?: string;
  summary?: string;
  score?: number;
  videoUrl: string;
  thumbnailUrl?: string;
  aspectRatio?: string;
  segments?: { start: number; end: number; text: string }[];
  createdAt: string;
}

export interface VideoJob {
  id: string;
  userId: string;
  youtubeUrl: string;
  videoId: string;
  title: string;
  duration: number;
  thumbnail?: string;
  channel?: string;
  status: JobStatus;
  progress: number;
  stage: JobStage;
  clipCount: number;
  estimatedSeconds: number;
  settings: JobSettings;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  clips?: Clip[];
}

export interface SubtitleSegment {
  start: number;
  end: number;
  text: string;
}

export interface PlannedClip {
  id: string;
  start: number;
  end: number;
  title: string;
  hook: string;
  score: number;
  category?: string;
  reason?: string;
  duration?: number;
  subtitles?: SubtitleSegment[];
}

export interface VideoPlanResponse {
  clips: PlannedClip[];
  videoDuration: number;
  transcriptCount?: number;
  hasRealSpeech?: boolean;
}

