import type { FFmpeg } from "@ffmpeg/ffmpeg";
import type { SubtitleSegment } from "@/types";
import { logger } from "./logger";

async function readFileAsUint8Array(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

export type LayoutMode = "standard" | "split_gaming";

export interface RenderClipOptions {
  formatRatio?: string;
  exportQuality?: ExportQuality;
  is4K?: boolean;
  is1440p?: boolean;
  is1080p?: boolean;
  is720p?: boolean;
  is480p?: boolean;
  layoutMode?: LayoutMode;
}

export interface ClientClip {
  id: string;
  title: string;
  hook: string;
  score: number;
  start: number;
  end: number;
  duration: number;
  blobUrl?: string;
  thumbnailUrl?: string;
  format?: string;
  subtitles?: SubtitleSegment[];
}

let ffmpeg: FFmpeg | null = null;
let isLoaded = false;
const activeVirtualFiles = new Set<string>();

/**
 * Extract video duration directly from browser Video element (0 server load)
 */
export async function getVideoDuration(file: File): Promise<number> {
  return (await getVideoMetadata(file)).duration;
}

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  qualityLabel: "2160p" | "1440p" | "1080p" | "720p" | "480p" | "360p" | "240p";
  readableQuality: string;
}

/**
 * Auto-detect video dimensions and quality (2160p 4K, 1440p, 1080p, 720p, 480p, 360p, 240p) instantly from file
 */
export async function getVideoMetadata(file: File): Promise<VideoMetadata> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return {
      duration: 60,
      width: 1920,
      height: 1080,
      qualityLabel: "1080p",
      readableQuality: "1080p (Full HD)",
    };
  }

  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    const objectUrl = URL.createObjectURL(file);
    let settled = false;

    const cleanup = () => {
      video.onloadedmetadata = null;
      video.onerror = null;
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(objectUrl);
    };

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
        resolve({
          duration: 60,
          width: 1920,
          height: 1080,
          qualityLabel: "1080p",
          readableQuality: "1080p (Full HD)",
        });
      }
    }, 6000);

    video.onloadedmetadata = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        const width = video.videoWidth || 1920;
        const height = video.videoHeight || 1080;
        let dur = video.duration;
        if (typeof dur !== "number" || isNaN(dur) || !isFinite(dur) || dur <= 0) {
          dur = 60;
        }
        cleanup();
        const minDim = Math.min(width, height);
        const maxDim = Math.max(width, height);

        let qualityLabel: "2160p" | "1440p" | "1080p" | "720p" | "480p" | "360p" | "240p" = "1080p";
        let readableQuality = "1080p (Full HD)";

        if (minDim >= 2160 || maxDim >= 3840) {
          qualityLabel = "2160p";
          readableQuality = "2160p (4K Ultra HD)";
        } else if (minDim >= 1440 || maxDim >= 2560) {
          qualityLabel = "1440p";
          readableQuality = "1440p (2K Quad HD)";
        } else if (minDim >= 1080 || maxDim >= 1920) {
          qualityLabel = "1080p";
          readableQuality = "1080p (Full HD)";
        } else if (minDim >= 720 || maxDim >= 1280) {
          qualityLabel = "720p";
          readableQuality = "720p (HD Ready)";
        } else if (minDim >= 480) {
          qualityLabel = "480p";
          readableQuality = "480p (SD)";
        } else if (minDim >= 360) {
          qualityLabel = "360p";
          readableQuality = "360p (Low)";
        } else {
          qualityLabel = "240p";
          readableQuality = "240p (Data Saver)";
        }

        resolve({
          duration: dur,
          width,
          height,
          qualityLabel,
          readableQuality,
        });
      }
    };
    video.onerror = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        cleanup();
        resolve({
          duration: 60,
          width: 1920,
          height: 1080,
          qualityLabel: "1080p",
          readableQuality: "1080p (Full HD)",
        });
      }
    };
    video.src = objectUrl;
  });
}

/**
 * Load WebAssembly FFmpeg core from local high-speed public bundle
 */
let ffmpegLoadingPromise: Promise<FFmpeg> | null = null;

export async function initClientFFmpeg(onLog?: (msg: string) => void): Promise<FFmpeg> {
  if (ffmpeg && isLoaded) return ffmpeg;
  if (ffmpegLoadingPromise) return ffmpegLoadingPromise;

  ffmpegLoadingPromise = (async () => {
    const [{ FFmpeg: FFmpegImpl }, { toBlobURL }] = await Promise.all([
      import("@ffmpeg/ffmpeg"),
      import("@ffmpeg/util"),
    ]);

    const instance = new FFmpegImpl();

    if (onLog) {
      instance.on("log", ({ message }) => onLog(message));
    }

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    try {
      await instance.load({
        coreURL: await toBlobURL(`${origin}/ffmpeg/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${origin}/ffmpeg/ffmpeg-core.wasm`, "application/wasm"),
      });
      ffmpeg = instance;
      isLoaded = true;
      ffmpegLoadingPromise = null;
      return ffmpeg;
    } catch (localErr) {
      logger.warn("Local FFmpeg load notice, attempting unpkg CDN fallback:", localErr);
      try {
        const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
        await instance.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
        });
        ffmpeg = instance;
        isLoaded = true;
        ffmpegLoadingPromise = null;
        return ffmpeg;
      } catch (cdnErr) {
        logger.error("Failed to load FFmpeg engine from both local and CDN:", cdnErr);
        ffmpeg = null;
        isLoaded = false;
        ffmpegLoadingPromise = null;
        throw new Error("Unable to load video processing engine. Please check your internet connection or disable ad-blockers and refresh.");
      }
    }
  })().catch((err) => {
    ffmpegLoadingPromise = null;
    throw err;
  });

  return ffmpegLoadingPromise;
}

/**
 * Mount source video file once into WebAssembly virtual FS (avoids duplicate RAM allocations)
 */
export async function mountSourceVideo(file: File, inputName: string = "source_video.mp4"): Promise<void> {
  const ff = await initClientFFmpeg();
  activeVirtualFiles.add(inputName);
  await ff.writeFile(inputName, await readFileAsUint8Array(file));
}

/**
 * Unmount source video file from WebAssembly virtual FS once all clips finish rendering
 */
export async function unmountSourceVideo(inputName: string = "source_video.mp4"): Promise<void> {
  activeVirtualFiles.delete(inputName);
  if (!ffmpeg || !isLoaded) return;
  try {
    await ffmpeg.deleteFile(inputName);
  } catch (err) {
    logger.warn(`Failed to cleanup virtual file ${inputName}:`, err);
  }
}

/**
 * Completely terminate and purge FFmpeg WebAssembly session.
 * Kills the worker, deletes all virtual files (MEMFS), and reclaims up to 2GB browser RAM immediately.
 */
export async function resetFFmpegSession(): Promise<void> {
  if (ffmpeg) {
    try {
      const files = new Set(["source_video.mp4", "audio.mp3", ...activeVirtualFiles]);
      for (const f of files) {
        try {
          await ffmpeg.deleteFile(f);
        } catch (err) {
          logger.warn(`Failed to delete virtual file ${f} in resetFFmpegSession:`, err);
        }
      }
      activeVirtualFiles.clear();
    } catch (err) {
      logger.warn("Failed to clear virtual files during FFmpeg session reset:", err);
    }
    try {
      ffmpeg.terminate();
    } catch (err) {
      logger.warn("Failed to terminate FFmpeg:", err);
    }
    ffmpeg = null;
    isLoaded = false;
  }
}

/**
 * Cut video clip locally in browser at 10x-50x speed
 */
export async function renderClipOnClient(
  file: File,
  clip: { id: string; start: number; end: number },
  onProgress?: (pct: number) => void,
  mountedInputName?: string,
  options?: RenderClipOptions
): Promise<{ blobUrl: string; thumbnailUrl: string }> {
  const ff = await initClientFFmpeg();

  const isMounted = Boolean(mountedInputName);
  const inputName = mountedInputName || `input_${clip.id}.mp4`;
  const outputName = `clip_${clip.id}.mp4`;
  const thumbName = `thumb_${clip.id}.jpg`;

  if (!isMounted) {
    activeVirtualFiles.add(inputName);
    await ff.writeFile(inputName, await readFileAsUint8Array(file));
  }
  activeVirtualFiles.add(outputName);
  activeVirtualFiles.add(thumbName);

  try {
    const startSec = Math.max(0, clip.start).toFixed(2);
  const durationSec = Math.max(0.5, clip.end - clip.start).toFixed(2);

  if (onProgress) onProgress(15);

  const progressCallback = ({ progress }: { progress: number }) => {
    if (onProgress) {
      // progress is between 0 and 1
      const pct = Math.min(90, Math.max(20, Math.round(progress * 100)));
      onProgress(pct);
    }
  };
  ff.on("progress", progressCallback);

  const formatRatio = options?.formatRatio || "9:16";
  const is4K = Boolean(options?.is4K || options?.exportQuality === "2160p");
  const is1440p = Boolean(options?.is1440p || options?.exportQuality === "1440p");
  const is1080p = Boolean(options?.is1080p || options?.exportQuality === "1080p");
  const is480p = Boolean(options?.is480p || options?.exportQuality === "480p");
  // Default on-device rendering to 720p HD Ready for maximum memory safety (avoids WASM out-of-bounds crashes)
  const is720p = Boolean(options?.is720p || (!is4K && !is1440p && !is1080p && !is480p));
  // Default layout mode to Gaming Fit (Center 16:9 + Ambient Blur) if not explicitly set
  const isSplitGaming = options?.layoutMode ? options.layoutMode === "split_gaming" : true;
  // Cinematic Gaming Landscape Fit Filter (Full 16:9 Landscape Video in Center + Ambient Blurred Top/Bottom)
  // Preserves 100% of the game screen, streamer webcam, HUD, and map without awkward crops
  // - Keeps natural aspect ratio on background (no vertical stretching or creepy distorted faces)
  // - Heavy diffusion blur melts background into pure ambient color waves
  // - Darkened backdrop (eq=brightness=-0.22) makes center video pop with studio contrast
  // - Clean thin border frames the center 16:9 video seamlessly
  // - Strictly uses integer-even dimensions to guarantee zero memory access out of bounds in WASM YUV420p
  const splitFilterGraph1080 =
    `[0:v]split=2[bg_in][video_in];` +
    `[bg_in]scale=-2:480,crop=270:480,boxblur=25:5,scale=1080:1920,eq=brightness=-0.22:contrast=0.85[bg];` +
    `[video_in]scale=1080:608,pad=1080:616:0:4:black[main_video];` +
    `[bg][main_video]overlay=0:652,format=yuv420p[outv]`;

  const splitFilterGraph720 =
    `[0:v]split=2[bg_in][video_in];` +
    `[bg_in]scale=-2:320,crop=180:320,boxblur=20:5,scale=720:1280,eq=brightness=-0.22:contrast=0.85[bg];` +
    `[video_in]scale=720:404,pad=720:412:0:4:black[main_video];` +
    `[bg][main_video]overlay=0:434,format=yuv420p[outv]`;

  // Calculate primary, fallback, and thumbnail scale filters based on formatRatio and resolution
  let scaleFilter = "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280";
  let fallbackFilter = "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280";
  let thumbFilter = "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280";

  if (formatRatio === "1:1") {
    if (is4K) {
      scaleFilter = "scale=2160:2160:force_original_aspect_ratio=increase,crop=2160:2160";
    } else if (is1440p) {
      scaleFilter = "scale=1440:1440:force_original_aspect_ratio=increase,crop=1440:1440";
    } else if (is1080p) {
      scaleFilter = "scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080";
    } else {
      scaleFilter = "scale=720:720:force_original_aspect_ratio=increase,crop=720:720";
    }
    fallbackFilter = "scale=720:720:force_original_aspect_ratio=increase,crop=720:720";
    thumbFilter = "scale=720:720:force_original_aspect_ratio=increase,crop=720:720";
  } else if (formatRatio === "16:9") {
    if (is4K) {
      scaleFilter = "scale=3840:2160:force_original_aspect_ratio=increase,crop=3840:2160";
    } else if (is1440p) {
      scaleFilter = "scale=2560:1440:force_original_aspect_ratio=increase,crop=2560:1440";
    } else if (is1080p) {
      scaleFilter = "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080";
    } else {
      scaleFilter = "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720";
    }
    fallbackFilter = "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720";
    thumbFilter = "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720";
  } else {
    // 9:16 Vertical
    if (is4K) {
      scaleFilter = "scale=2160:3840:force_original_aspect_ratio=increase,crop=2160:3840";
    } else if (is1440p) {
      scaleFilter = "scale=1440:2560:force_original_aspect_ratio=increase,crop=1440:2560";
    } else if (is1080p) {
      scaleFilter = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920";
    } else if (is720p) {
      scaleFilter = "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280";
    } else {
      scaleFilter = "scale=480:854:force_original_aspect_ratio=increase,crop=480:854";
    }
    fallbackFilter = "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280";
    thumbFilter = "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280";
  }

  // High-Fidelity Rendering with Memory-Safe Single-Threaded Presets
  const activeSplitFilter = is1080p || is4K ? splitFilterGraph1080 : splitFilterGraph720;

  try {
    if (isSplitGaming) {
      await ff.exec([
        "-ss",
        startSec,
        "-i",
        inputName,
        "-t",
        durationSec,
        "-filter_complex",
        activeSplitFilter,
        "-map",
        "[outv]",
        "-map",
        "0:a?",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-crf",
        "22",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-y",
        outputName,
      ]);
    } else {
      await ff.exec([
        "-ss",
        startSec,
        "-i",
        inputName,
        "-t",
        durationSec,
        "-vf",
        scaleFilter,
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-crf",
        "22",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-y",
        outputName,
      ]);
    }
  } catch {
    // If primary filter encounters tight memory, fallback to lightweight 720p
    try {
      if (isSplitGaming) {
        await ff.exec([
          "-ss",
          startSec,
          "-i",
          inputName,
          "-t",
          durationSec,
          "-filter_complex",
          splitFilterGraph720,
          "-map",
          "[outv]",
          "-map",
          "0:a?",
          "-c:v",
          "libx264",
          "-preset",
          "ultrafast",
          "-crf",
          "24",
          "-c:a",
          "aac",
          "-b:a",
          "128k",
          "-y",
          outputName,
        ]);
      } else {
        await ff.exec([
          "-ss",
          startSec,
          "-i",
          inputName,
          "-t",
          durationSec,
          "-vf",
          fallbackFilter,
          "-c:v",
          "libx264",
          "-preset",
          "ultrafast",
          "-crf",
          "24",
          "-c:a",
          "aac",
          "-b:a",
          "128k",
          "-y",
          outputName,
        ]);
      }
    } catch {
      // Emergency ultra-fast fallback
      await ff.exec([
        "-ss",
        startSec,
        "-i",
        inputName,
        "-t",
        durationSec,
        "-vf",
        fallbackFilter,
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-crf",
        "26",
        "-c:a",
        "aac",
        "-b:a",
        "96k",
        "-y",
        outputName,
      ]);
    }
  } finally {
    ff.off("progress", progressCallback);
  }

  if (onProgress) onProgress(95);

  // Extract crisp high-resolution thumbnail frame
  try {
    if (isSplitGaming) {
      await ff.exec([
        "-ss",
        startSec,
        "-i",
        inputName,
        "-filter_complex",
        activeSplitFilter,
        "-map",
        "[outv]",
        "-frames:v",
        "1",
        "-q:v",
        "3",
        "-y",
        thumbName,
      ]);
    } else {
      await ff.exec([
        "-ss",
        startSec,
        "-i",
        inputName,
        "-vf",
        thumbFilter,
        "-frames:v",
        "1",
        "-q:v",
        "3",
        "-y",
        thumbName,
      ]);
    }
  } catch {
    // Fallback thumbnail extraction
    await ff.exec([
      "-ss",
      startSec,
      "-i",
      inputName,
      "-frames:v",
      "1",
      "-y",
      thumbName,
    ]);
  }

  let videoData: Uint8Array;
  try {
    videoData = (await ff.readFile(outputName)) as Uint8Array;
  } catch (fsErr) {
    logger.warn("Primary clip read notice, attempting recovery:", fsErr);
    throw new Error(`Clip ${clip.id} could not be encoded. Video was skipped.`);
  }

  let thumbData: Uint8Array;
  try {
    thumbData = (await ff.readFile(thumbName)) as Uint8Array;
  } catch {
    // Valid minimal 1x1 JPEG placeholder to avoid browser ERR_IMAGE_INVALID decode errors
    thumbData = new Uint8Array([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
      0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
      0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
      0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20, 0x24, 0x2E, 0x27, 0x20,
      0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29, 0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27,
      0x39, 0x3D, 0x38, 0x32, 0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
      0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
      0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
      0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F,
      0x00, 0xBF, 0x80, 0xFF, 0xD9
    ]);
  }

  // CRITICAL MEMORY ISOLATION:
  // Clone buffers into independent JS memory heap (.slice()) before deleting virtual files from MEMFS.
  // This prevents detached buffer errors ("ERR_REQUEST_RANGE_NOT_SATISFIABLE") and WASM heap corruption.
  const safeVideoBuffer = new Uint8Array(videoData).slice();
  const safeThumbBuffer = new Uint8Array(thumbData).slice();

  const videoBlob = new Blob([safeVideoBuffer], { type: "video/mp4" });
  const thumbBlob = new Blob([safeThumbBuffer], { type: "image/jpeg" });

  const blobUrl = URL.createObjectURL(videoBlob);
  const thumbnailUrl = URL.createObjectURL(thumbBlob);

  if (onProgress) onProgress(100);

  return { blobUrl, thumbnailUrl };
  } finally {
    // Cleanup virtual files immediately to free WASM heap
    if (!isMounted) {
      activeVirtualFiles.delete(inputName);
      try {
        await ff.deleteFile(inputName);
      } catch (err) {
        logger.warn(`Failed to cleanup virtual file ${inputName}:`, err);
      }
    }
    activeVirtualFiles.delete(outputName);
    try {
      await ff.deleteFile(outputName);
    } catch (err) {
      logger.warn(`Failed to cleanup virtual file ${outputName}:`, err);
    }
    activeVirtualFiles.delete(thumbName);
    try {
      await ff.deleteFile(thumbName);
    } catch (err) {
      logger.warn(`Failed to cleanup virtual file ${thumbName}:`, err);
    }
  }
}

/**
 * Extract lightweight mono audio directly on user device using FFmpeg.
 * Reads directly from mounted source buffer to avoid duplicate memory copies.
 * Supports full video timeline with ultra-fast stream copy and 24MB payload safety.
 */
export async function extractAudioFromVideo(
  file: File,
  videoDurationSeconds?: number,
  mountedInputName?: string
): Promise<Blob> {
  if (videoDurationSeconds) {
    logger.info(`Extracting audio from video (${Math.round(videoDurationSeconds)}s)...`);
  }
  const ff = await initClientFFmpeg();
  const inputName = mountedInputName || `audio_in_${Date.now()}.mp4`;
  const outputAudioM4A = `audio_fast_${Date.now()}.m4a`;
  const outputAudioMP3 = `audio_fallback_${Date.now()}.mp3`;

  if (!mountedInputName) {
    activeVirtualFiles.add(inputName);
    await ff.writeFile(inputName, await readFileAsUint8Array(file));
  }
  activeVirtualFiles.add(outputAudioM4A);
  activeVirtualFiles.add(outputAudioMP3);

  const MAX_FAST_COPY_BYTES = 4 * 1024 * 1024; // 4 MB threshold: if stream-copied audio is larger, compress to lightweight mono AAC
  const MAX_GROQ_BYTES = 24 * 1024 * 1024; // 24 MB safe threshold for Groq Whisper
  let successfulOutput = outputAudioM4A;
  let mimeType = "audio/mp4";

  // Strategy 1: Fast stream copy (<200ms) if audio is already compact (<4MB)
  try {
    await ff.exec([
      "-i", inputName,
      "-vn",
      "-c:a", "copy",
      "-y", outputAudioM4A
    ]);

    const audioData = (await ff.readFile(outputAudioM4A)) as Uint8Array;
    if (audioData.byteLength > MAX_FAST_COPY_BYTES) {
      throw new Error("Stream copied audio exceeds 4MB, compressing to ultra-lightweight 16kHz mono AAC");
    }
  } catch {
    // Strategy 2: High efficiency 32kbps mono 16kHz AAC (Fits 30 mins within ~2MB!)
    try {
      await ff.exec([
        "-i", inputName,
        "-vn",
        "-c:a", "aac",
        "-b:a", "32k",
        "-ac", "1",
        "-ar", "16000",
        "-y", outputAudioM4A
      ]);
      const audioData = (await ff.readFile(outputAudioM4A)) as Uint8Array;
      if (audioData.byteLength > MAX_GROQ_BYTES) {
        throw new Error("AAC mono exceeds 24MB, falling back to compressed MP3");
      }
    } catch {
      // Strategy 3: Ultra-compact 24kbps mono MP3 fallback
      successfulOutput = outputAudioMP3;
      mimeType = "audio/mpeg";
      await ff.exec([
        "-i", inputName,
        "-vn",
        "-c:a", "libmp3lame",
        "-b:a", "24k",
        "-ac", "1",
        "-ar", "16000",
        "-y", outputAudioMP3
      ]);
    }
  }

  let audioBlob: Blob;
  try {
    const audioData = (await ff.readFile(successfulOutput)) as Uint8Array;
    const safeAudioBuffer = new Uint8Array(audioData).slice();
    audioBlob = new Blob([safeAudioBuffer], { type: mimeType });
  } finally {
    if (!mountedInputName) {
      activeVirtualFiles.delete(inputName);
      try {
        await ff.deleteFile(inputName);
      } catch (err) {
        logger.warn(`Failed to cleanup audio input ${inputName}:`, err);
      }
    }
    activeVirtualFiles.delete(outputAudioM4A);
    try {
      await ff.deleteFile(outputAudioM4A);
    } catch (err) {
      logger.warn(`Failed to cleanup audio output ${outputAudioM4A}:`, err);
    }
    activeVirtualFiles.delete(outputAudioMP3);
    try {
      await ff.deleteFile(outputAudioMP3);
    } catch (err) {
      logger.warn(`Failed to cleanup audio output ${outputAudioMP3}:`, err);
    }
  }

  return audioBlob;
}

export type ExportQuality = "auto" | "2160p" | "1440p" | "1080p" | "720p" | "480p" | "360p" | "240p";

/**
 * Scale / re-encode clip to requested quality (Auto, 2160p, 1440p, 1080p, 720p, 480p, 360p, 240p) before downloading
 */
export async function transcodeClipQuality(
  blobUrl: string,
  targetQuality: ExportQuality,
  format: string = "9:16"
): Promise<string> {
  // If requesting auto (native source quality) or 2160p, return full-res blob directly with 0 compression loss
  if (targetQuality === "auto" || targetQuality === "2160p") return blobUrl;

  const ff = await initClientFFmpeg();
  const res = await fetch(blobUrl);
  const videoBytes = new Uint8Array(await res.arrayBuffer());

  const inName = `scale_in_${Date.now()}.mp4`;
  const outName = `scale_out_${Date.now()}.mp4`;

  activeVirtualFiles.add(inName);
  activeVirtualFiles.add(outName);
  await ff.writeFile(inName, videoBytes);

  let scaleFilter = format === "9:16" ? "scale=1080:1920" : (format === "1:1" ? "scale=1080:1080" : "scale=1920:1080");
  if (targetQuality === "1440p") {
    scaleFilter = format === "9:16" ? "scale=1440:2560" : (format === "1:1" ? "scale=1440:1440" : "scale=2560:1440");
  } else if (targetQuality === "1080p") {
    scaleFilter = format === "9:16" ? "scale=1080:1920" : (format === "1:1" ? "scale=1080:1080" : "scale=1920:1080");
  } else if (targetQuality === "720p") {
    scaleFilter = format === "9:16" ? "scale=720:1280" : (format === "1:1" ? "scale=720:720" : "scale=1280:720");
  } else if (targetQuality === "480p") {
    scaleFilter = format === "9:16" ? "scale=480:854" : (format === "1:1" ? "scale=480:480" : "scale=854:480");
  } else if (targetQuality === "360p") {
    scaleFilter = format === "9:16" ? "scale=360:640" : (format === "1:1" ? "scale=360:360" : "scale=640:360");
  } else if (targetQuality === "240p") {
    scaleFilter = format === "9:16" ? "scale=240:426" : (format === "1:1" ? "scale=240:240" : "scale=426:240");
  }

  try {
    await ff.exec([
      "-i", inName,
      "-vf", scaleFilter,
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "18",
      "-c:a", "copy",
      "-y", outName
    ]);
    const scaledData = (await ff.readFile(outName)) as Uint8Array;
    const safeScaledBuffer = new Uint8Array(scaledData).slice();
    const scaledBlob = new Blob([safeScaledBuffer], { type: "video/mp4" });
    return URL.createObjectURL(scaledBlob);
  } catch {
    // If transcoding fails, fallback to original high-res blob
    return blobUrl;
  } finally {
    activeVirtualFiles.delete(inName);
    try {
      await ff.deleteFile(inName);
    } catch (err) {
      logger.warn(`Failed to cleanup transcode input ${inName}:`, err);
    }
    activeVirtualFiles.delete(outName);
    try {
      await ff.deleteFile(outName);
    } catch (err) {
      logger.warn(`Failed to cleanup transcode output ${outName}:`, err);
    }
  }
}
