export type AdminRole = "SUPER_ADMIN" | "ADMIN" | "SUPPORT";
export type AdminStatus = "ACTIVE" | "SUSPENDED";

export interface AdminUser {
  id: string;
  email: string;
  name?: string;
  role: AdminRole;
  status: AdminStatus;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminAuthResponse {
  access_token: string;
  token_type: string;
  admin: AdminUser;
}

export interface AdminDashboardKPIs {
  totalUsers: number;
  activeUsers: number;
  totalJobs: number;
  jobsToday: number;
  processingJobs: number;
  completedJobs: number;
  failedJobs: number;
  totalClips: number;
  storageUsedFormatted: string;
  storageBytes: number;
  avgProcessingTimeSeconds: number;
}

export interface QueueMetrics {
  depth: number;
  workersActive: number;
  status: string;
  redisConnected: boolean;
}

export interface RecentJobItem {
  id: string;
  userId: string;
  userEmail: string;
  title: string;
  status: string;
  stage: string;
  progress: number;
  clipCount: number;
  createdAt: string;
  completedAt?: string;
  error?: string;
}

export interface RecentErrorItem {
  id: string;
  service: string;
  errorType: string;
  message: string;
  status: string;
  timestamp: string;
}

export interface AdminDashboardData {
  kpis: AdminDashboardKPIs;
  queue: QueueMetrics;
  recentJobs: RecentJobItem[];
  recentErrors: RecentErrorItem[];
  systemStatus: "healthy" | "degraded" | "down";
}

export interface AdminUserRow {
  id: string;
  email: string;
  status: "active" | "suspended";
  jobCount: number;
  clipCount: number;
  storageMb: number;
  createdAt: string;
  lastActive: string;
}

export interface AdminUserDetail {
  user: {
    id: string;
    email: string;
    status: "active" | "suspended";
    createdAt: string;
    updatedAt: string;
    suspensionReason?: string;
    suspendedAt?: string;
    suspendedBy?: string;
  };
  usage: {
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    totalClips: number;
    storageMb: number;
  };
  recentJobs: Array<{
    id: string;
    title: string;
    status: string;
    clipCount: number;
    createdAt: string;
  }>;
  recentClips: Array<{
    id: string;
    title: string;
    duration: number;
    score: number;
    createdAt: string;
  }>;
}

export interface AdminJobRow {
  id: string;
  userId: string;
  userEmail: string;
  title: string;
  youtubeUrl: string;
  status: string;
  stage: string;
  progress: number;
  clipCount: number;
  duration: number;
  processingMode?: "cloud" | "on-device";
  isClientRendered?: boolean;
  createdAt: string;
  completedAt?: string;
  error?: string;
}

export interface AdminJobDetail {
  job: {
    id: string;
    userId: string;
    userEmail: string;
    youtubeUrl: string;
    videoId: string;
    title: string;
    thumbnail?: string;
    duration: number;
    status: string;
    stage: string;
    progress: number;
    clipCount: number;
    processingMode?: "cloud" | "on-device";
    isClientRendered?: boolean;
    settings: Record<string, any>;
    createdAt: string;
    startedAt?: string;
    completedAt?: string;
    error?: string;
  };
  stages: Array<{
    name: string;
    key: string;
    done: boolean;
  }>;
  logs: Array<{
    timestamp: string;
    message: string;
  }>;
  clips: Array<{
    id: string;
    title: string;
    hook: string;
    duration: number;
    startTime: number;
    endTime: number;
    score: number;
    videoUrl: string;
    thumbnailUrl?: string;
    createdAt: string;
  }>;
}

export interface AdminClipRow {
  id: string;
  jobId: string;
  jobTitle: string;
  userId: string;
  userEmail: string;
  title: string;
  hook: string;
  duration: number;
  startTime: number;
  endTime: number;
  score: number;
  videoUrl: string;
  thumbnailUrl?: string;
  cloudinaryPublicId?: string;
  createdAt: string;
}

export interface AdminStorageData {
  summary: {
    totalBytes: number;
    totalFormatted: string;
    clipStorageBytes: number;
    clipStorageFormatted: string;
    thumbnailStorageBytes: number;
    thumbnailStorageFormatted: string;
    tempCacheBytes: number;
    tempCacheFormatted: string;
  };
  counts: {
    clips: number;
    thumbnails: number;
    tempFiles: number;
  };
  cleanupPreview: {
    orphanedFailedMediaCount: number;
    orphanedFailedMediaBytes: number;
    orphanedFormatted: string;
    tempFilesCount: number;
    tempFilesBytes: number;
  };
  cloudinary: {
    configured: boolean;
    cloudName: string;
  };
  layers?: {
    cdn: {
      name: string;
      type: string;
      purpose: string;
      provider: string;
      bytes: number;
      formatted: string;
      clipFiles: number;
      thumbFiles: number;
      status: string;
    };
    mongodb: {
      name: string;
      type: string;
      purpose: string;
      database: string;
      connected: boolean;
      totalDocuments: number;
      collections: {
        users: number;
        jobs: number;
        clips: number;
      };
      bytes: number;
      formatted: string;
    };
    diskCache: {
      name: string;
      type: string;
      purpose: string;
      bytes: number;
      formatted: string;
      fileCount: number;
      cleanupTarget: boolean;
    };
  };
}

export interface SystemHealthData {
  timestamp: string;
  overall: string;
  services: {
    api: { status: string; latencyMs: number; version: string };
    database: { status: string; latencyMs: number | null; mode: string };
    queue: { status: string; mode: string };
    ffmpeg: { status: string; available: boolean; path: string };
    cloudinary: { status: string; cloudName: string; mode: string };
    aiProvider: { status: string; model: string; provider: string };
    transcriptEngine: { status: string; engine: string };
  };
  environment: string;
}

export interface SystemLogEntry {
  id: string;
  level: string;
  service: string;
  message: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface AuditLogEntry {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface SystemSettingsData {
  projectName: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  supportEmail: string;
  freeTierDailyLimit: number;
  maxClipsPerJob: number;
  maxVideoDurationSeconds: number;
  allowAnonymousPreviews: boolean;
  maxConcurrentWorkers: number;
  jobTimeoutSeconds: number;
  maxRetryAttempts: number;
  overlapDeduplicationThreshold: number;
  sentenceSnapBoundarySeconds: number;
  retentionDays: number;
  autoCleanupOrphanedMedia: boolean;
  maxUserStorageBytes: number;
  sessionTimeoutMinutes: number;
  requireAdmin2FA: boolean;
  maxLoginAttempts: number;
  lockoutDurationMinutes?: number;
  updatedBy?: string;
  updatedAt?: string;
}
