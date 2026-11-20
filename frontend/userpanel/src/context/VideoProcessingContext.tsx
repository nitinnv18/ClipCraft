"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import {
  ClientClip,
  getVideoDuration,
  renderClipOnClient,
  initClientFFmpeg,
  mountSourceVideo,
  unmountSourceVideo,
  extractAudioFromVideo,
  ExportQuality,
  LayoutMode,
  resetFFmpegSession,
} from "@/lib/clientVideoProcessor";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";
import { PlannedClip, VideoPlanResponse } from "@/types";

export interface SavedSession {
  selectedFile: File | null;
  fileName: string;
  clientClips: ClientClip[];
  plannedClips: PlannedClip[];
  activeClientClip: ClientClip | null;
  clientProgress: number;
  completedAt: string;
}

interface VideoProcessingContextType {
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  clientClips: ClientClip[];
  plannedClips: PlannedClip[];
  renderingClipIndex: number;
  activeClientClip: ClientClip | null;
  setActiveClientClip: (clip: ClientClip | null) => void;
  clientProgress: number;
  setClientProgress: (p: number) => void;
  isSubmitting: boolean;
  setIsSubmitting: (b: boolean) => void;
  uploadStatusText: string;
  setUploadStatusText: (s: string) => void;
  error: string | null;
  setError: (err: string | null) => void;
  previousSession: SavedSession | null;
  restorePreviousSession: () => void;
  abortProcessing: () => void;
  startClientProcessing: (
    file: File,
    options: {
      clipCount: number;
      minDuration: number;
      maxDuration: number;
      format?: string;
      exportQuality?: ExportQuality;
      layoutMode?: LayoutMode;
      language?: string;
    }
  ) => Promise<boolean>;
  resetStudio: (saveAsPrevious?: boolean) => void;
}

const VideoProcessingContext = createContext<VideoProcessingContextType | undefined>(
  undefined
);

export const VideoProcessingProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const abortRef = useRef<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [clientClips, setClientClips] = useState<ClientClip[]>([]);
  const [plannedClips, setPlannedClips] = useState<PlannedClip[]>([]);
  const [renderingClipIndex, setRenderingClipIndex] = useState<number>(-1);
  const [activeClientClip, setActiveClientClip] = useState<ClientClip | null>(null);
  const [clientProgress, setClientProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [previousSession, setPreviousSession] = useState<SavedSession | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  // Keep a ref to clientClips and previousSession so unmount cleanup revokes all active blob URLs
  const clientClipsRef = useRef<ClientClip[]>(clientClips);
  useEffect(() => {
    clientClipsRef.current = clientClips;
  }, [clientClips]);

  const previousSessionRef = useRef<SavedSession | null>(previousSession);
  useEffect(() => {
    previousSessionRef.current = previousSession;
  }, [previousSession]);

  // Prevent accidental browser tab close / refresh during video rendering
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isSubmitting) {
        e.preventDefault();
        e.returnValue = "Video clipping is currently in progress. Leaving will cancel rendering.";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isSubmitting]);

  const revokeClipUrls = (clips: ClientClip[]) => {
    clips.forEach((c) => {
      if (c.blobUrl?.startsWith("blob:")) URL.revokeObjectURL(c.blobUrl);
      if (c.thumbnailUrl?.startsWith("blob:")) URL.revokeObjectURL(c.thumbnailUrl);
    });
  };

  // Revoke any pending client clip blob URLs and reset FFmpeg session on unmount
  useEffect(() => {
    return () => {
      revokeClipUrls(clientClipsRef.current);
      if (previousSessionRef.current) {
        revokeClipUrls(previousSessionRef.current.clientClips);
      }
      resetFFmpegSession().catch(() => {});
    };
  }, []);

  const resetStudio = (saveAsPrevious: boolean = true) => {
    // Release WASM memory and purge lingering files
    resetFFmpegSession().catch(() => {});
    // Preserve current session before clearing, so user can return to it anytime!
    if (saveAsPrevious && clientClips.length > 0) {
      if (previousSession) {
        revokeClipUrls(previousSession.clientClips);
      }
      setPreviousSession({
        selectedFile,
        fileName: selectedFile?.name || "Previous Video",
        clientClips: [...clientClips],
        plannedClips: [...plannedClips],
        activeClientClip: activeClientClip || clientClips[0] || null,
        clientProgress: 100,
        completedAt: new Date().toISOString(),
      });
    } else {
      revokeClipUrls(clientClips);
      if (previousSession) {
        revokeClipUrls(previousSession.clientClips);
        setPreviousSession(null);
      }
    }
    setClientClips([]);
    setSelectedFile(null);
    setActiveClientClip(null);
    setPlannedClips([]);
    setRenderingClipIndex(-1);
    setIsSubmitting(false);
    setClientProgress(0);
    setUploadStatusText("");
    setError(null);
  };

  const restorePreviousSession = () => {
    if (!previousSession) return;
    if (clientClips.length > 0 && clientClips !== previousSession.clientClips) {
      revokeClipUrls(clientClips);
    }
    setSelectedFile(previousSession.selectedFile);
    setClientClips([...previousSession.clientClips]);
    setPlannedClips([...previousSession.plannedClips]);
    setActiveClientClip(previousSession.activeClientClip);
    setClientProgress(100);
    setIsSubmitting(false);
    setUploadStatusText(`Restored clips from ${previousSession.fileName}`);
  };

  const abortProcessing = () => {
    abortRef.current = true;
    resetFFmpegSession().catch(() => {});
    revokeClipUrls(clientClips);
    setClientClips([]);
    setActiveClientClip(null);
    if (currentJobId && selectedFile) {
      api.syncClientJob({
        id: currentJobId,
        title: selectedFile.name,
        duration: 0,
        clipCount: clientClips.length || 5,
        status: "failed",
        progress: clientProgress,
        clips: clientClips,
      }).catch(() => {});
    }
    setIsSubmitting(false);
    setRenderingClipIndex(-1);
    setClientProgress(0);
    setUploadStatusText("Rendering aborted by user.");
  };

  const startClientProcessing = async (
    file: File,
    options: {
      clipCount: number;
      minDuration: number;
      maxDuration: number;
      format?: string;
      exportQuality?: ExportQuality;
      layoutMode?: LayoutMode;
      language?: string;
    }
  ): Promise<boolean> => {
    // 0. Force-purge any previous job RAM, revoke old video Blob URLs, and reset FFmpeg WASM worker
    if (previousSession) {
      revokeClipUrls(previousSession.clientClips);
      setPreviousSession(null);
    }
    revokeClipUrls(clientClips);
    setClientClips([]);
    setActiveClientClip(null);
    setPlannedClips([]);
    await resetFFmpegSession();

    const activeJobId = `job_${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "").substring(0, 12) : Date.now().toString(36)}`;
    setCurrentJobId(activeJobId);
    setSelectedFile(file);
    setIsSubmitting(true);
    setClientProgress(5);
    setError(null);

    // 1. Immediately sync with backend with status "processing" so Admin Panel & History show it live!
    try {
      await api.syncClientJob({
        id: activeJobId,
        title: file.name,
        duration: 0,
        clipCount: options.clipCount,
        status: "processing",
        progress: 5,
        clips: [],
      });
    } catch (syncInitErr) {
      logger.warn("Initial job sync notice (resilient mode):", syncInitErr);
    }

    try {
      setUploadStatusText("Analyzing video metadata & file properties...");
      setClientProgress(10);

      const duration = await getVideoDuration(file);
      setUploadStatusText("Groq AI detecting viral highlight moments...");
      setClientProgress(20);

      let plan: VideoPlanResponse | null = null;

      // Timeout wrapper to guarantee client never gets stuck at 20%
      const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
        return Promise.race([
          promise,
          new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs)
          ),
        ]);
      };

      const mountedSource = `source_${Date.now()}.mp4`;
      let isSourceMounted = false;

      // Step 1: Pre-mount video once into hardware buffer & extract audio for Groq Whisper (0 redundant memory writes)
      try {
        setUploadStatusText("Pre-loading video buffer into hardware engine...");
        setClientProgress(12);
        await initClientFFmpeg();
        await mountSourceVideo(file, mountedSource);
        isSourceMounted = true;

        setUploadStatusText("Extracting audio track for Groq Whisper speech AI...");
        setClientProgress(15);
        const audioBlob = await withTimeout(
          extractAudioFromVideo(file, duration, mountedSource),
          30000,
          "Audio extraction"
        );
        
        setUploadStatusText("Groq Whisper listening & transcribing speech (~1s)...");
        setClientProgress(18);
        plan = await withTimeout(
          api.getPlanWithAudio(audioBlob, {
            duration,
            title: file.name,
            clipCount: options.clipCount,
            minDuration: options.minDuration,
            maxDuration: options.maxDuration,
            language: options.language,
          }),
          20000,
          "Speech AI planning"
        );
        
        if (plan?.hasRealSpeech) {
          setUploadStatusText(`Groq transcribed ${plan.transcriptCount} speech moments! Selecting viral clips...`);
        }
      } catch (audioPlanErr: unknown) {
        logger.warn("Audio speech plan notice, falling back to contextual planner:", audioPlanErr);
      }

      // Step 2: Fallback to contextual Groq planner if audio extraction wasn't completed
      if (!plan || !plan.clips || !plan.clips.length) {
        try {
          setUploadStatusText("Groq AI detecting viral hooks and moments...");
          setClientProgress(20);
          plan = await withTimeout(
            api.getPlan({
              duration,
              title: file.name,
              clipCount: options.clipCount,
              minDuration: options.minDuration,
              maxDuration: options.maxDuration,
            }),
            12000,
            "Contextual AI planning"
          );
        } catch (planErr: unknown) {
          logger.warn("AI plan notice, utilizing heuristic highlight planner:", planErr);
          const cleanName = file.name.replace(/[\-_.]+/g, " ").replace(".mp4", "").trim();
          const step = Math.max(15, Math.floor(duration / (options.clipCount + 1)));
          const defaultHooks = [
            `Wait for the plot twist in ${cleanName}...`,
            "Nobody expected this to happen on day one!",
            "Watch until the end, this changed everything completely.",
            "The most intense moment that nobody saw coming.",
            "I couldn't believe what happened next 😱",
          ];

          plan = {
            clips: Array.from({ length: options.clipCount }).map((_, i) => {
              const hook = defaultHooks[i % defaultHooks.length];
              const words = hook.split(" ");
              const dur = options.minDuration;
              const chunks = [];
              for (let w = 0; w < words.length; w += 3) {
                chunks.push(words.slice(w, w + 3).join(" "));
              }
              const chunkStep = dur / Math.max(1, chunks.length);
              const subs = chunks.map((chunk, cIdx) => ({
                start: Math.round(cIdx * chunkStep * 10) / 10,
                end: Math.round((cIdx + 1) * chunkStep * 10) / 10,
                text: chunk,
              }));

              return {
                id: `clip_${i + 1}`,
                title: `Viral Moment #${i + 1} • ${cleanName.slice(0, 20)}`,
                hook,
                score: Math.min(98, 96 - i * 3),
                start: i * step,
                end: Math.min(duration, i * step + options.minDuration),
                duration: options.minDuration,
                subtitles: subs,
              };
            }),
            videoDuration: duration,
          };
        }
      }

      const rawClips = plan.clips || [];
      if (!rawClips.length) {
        throw new Error("No highlights found for this video duration.");
      }

      setPlannedClips(rawClips);
      setClientProgress(23);

      if (!isSourceMounted) {
        setUploadStatusText("Loading on-device hardware acceleration engine...");
        await initClientFFmpeg();
        await mountSourceVideo(file, mountedSource);
        isSourceMounted = true;
      }

      setClientProgress(25);
      const rendered: ClientClip[] = [];

      let is4K = options.exportQuality === "2160p";
      let is1440p = options.exportQuality === "1440p";
      let is1080p = options.exportQuality === "1080p";
      let is480p = options.exportQuality === "480p";
      // Default browser rendering to 720p HD Ready for rock-solid memory stability (prevents 2GB WASM out of bounds)
      let is720p = options.exportQuality === "720p" || (!is4K && !is1440p && !is1080p && !is480p);

      try {
        abortRef.current = false;
        for (let i = 0; i < rawClips.length; i++) {
          if (abortRef.current) {
            logger.warn("Client rendering aborted by user");
            break;
          }
          setRenderingClipIndex(i);
          const c = rawClips[i];
          const basePct = Math.round(25 + (i / rawClips.length) * 70);
          setClientProgress(basePct);
          setUploadStatusText(
            `Rendering Clip ${i + 1} of ${rawClips.length} directly on device (${basePct}%)...`
          );

          let lastReportedTotal = -1;
          try {
            const res = await renderClipOnClient(
              file,
              { id: c.id || `clip_${i + 1}`, start: c.start, end: c.end },
              (clipPct) => {
                const currentTotal = Math.min(
                  97,
                  Math.round(25 + ((i * 100 + clipPct) / (rawClips.length * 100)) * 70)
                );
                if (currentTotal !== lastReportedTotal) {
                  lastReportedTotal = currentTotal;
                  setClientProgress(currentTotal);
                  setUploadStatusText(
                    `Rendering Clip ${i + 1}/${rawClips.length} (${currentTotal}%)...`
                  );
                }
              },
              mountedSource,
              {
                formatRatio: options.format,
                exportQuality: options.exportQuality,
                is4K,
                is1440p,
                is1080p,
                is720p,
                is480p,
                layoutMode: options.layoutMode,
              }
            );

            const newClip: ClientClip = {
              id: c.id || `clip_${i + 1}`,
              title: c.title || `Viral Moment #${i + 1}`,
              hook: c.hook || "Watch what happens next!",
              score: c.score || 92,
              start: c.start,
              end: c.end,
              duration: c.duration || c.end - c.start,
              blobUrl: res.blobUrl,
              thumbnailUrl: res.thumbnailUrl,
              format: options.format || "9:16",
              subtitles: c.subtitles || [],
            };
            rendered.push(newClip);
            setClientClips([...rendered]);
            if (rendered.length === 1) {
              setActiveClientClip(newClip);
            }

            // Optimized sync: notify backend on 1st clip and halfway through, reducing DB writes by ~75% while keeping Admin panel live!
            const shouldSyncIntermediate = i === 0 || i === Math.floor(rawClips.length / 2);
            if (shouldSyncIntermediate) {
              try {
                await api.syncClientJob({
                  id: activeJobId,
                  title: file.name,
                  duration,
                  clipCount: options.clipCount,
                  status: "processing",
                  progress: basePct,
                  clips: rendered,
                });
              } catch (err) {
                logger.debug("Intermediate client job sync failed (non-blocking):", err);
              }
            }

            // Allow browser Garbage Collector to flush memory buffer between clips (prevents 70% freeze)
            await new Promise((resolve) => setTimeout(resolve, 150));
          } catch (renderErr) {
            logger.error("Local clip rendering encountered an error:", renderErr);
          }
        }
      } finally {
        if (isSourceMounted) {
          await unmountSourceVideo(mountedSource);
        }
        await resetFFmpegSession();
      }

      setRenderingClipIndex(-1);
      if (rendered.length > 0) {
        setClientProgress(100);
        setUploadStatusText(
          `All ${rendered.length} viral clips generated successfully!`
        );
        setIsSubmitting(false);

        // Final sync: mark status "completed" with all clips!
        try {
          await api.syncClientJob({
            id: activeJobId,
            title: file.name,
            duration,
            clipCount: rendered.length,
            clips: rendered,
            status: "completed",
            progress: 100,
          });
        } catch (syncErr) {
          logger.warn("Client job background sync notice (resilient mode):", syncErr);
        }

        return true;
      } else {
        throw new Error(
          "Rendering could not complete on this device. Please check file format or try a shorter video."
        );
      }
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error
          ? err.message
          : "Failed to process video clips locally on device.";
      setError(errMsg);
      setIsSubmitting(false);

      try {
        await api.syncClientJob({
          id: activeJobId,
          title: file.name,
          duration: 0,
          clipCount: options.clipCount,
          status: "failed",
          progress: clientProgress,
          clips: [],
        });
      } catch (err) {
        logger.warn("Failed to report failed job status to backend:", err);
      }

      return false;
    }
  };

  return (
    <VideoProcessingContext.Provider
      value={{
        selectedFile,
        setSelectedFile,
        clientClips,
        plannedClips,
        renderingClipIndex,
        activeClientClip,
        setActiveClientClip,
        clientProgress,
        setClientProgress,
        isSubmitting,
        setIsSubmitting,
        uploadStatusText,
        setUploadStatusText,
        error,
        setError,
        previousSession,
        restorePreviousSession,
        abortProcessing,
        startClientProcessing,
        resetStudio,
      }}
    >
      {children}
    </VideoProcessingContext.Provider>
  );
};

export const useVideoProcessing = () => {
  const context = useContext(VideoProcessingContext);
  if (!context) {
    throw new Error(
      "useVideoProcessing must be used within a VideoProcessingProvider"
    );
  }
  return context;
};
