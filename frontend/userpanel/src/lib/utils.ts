import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatSeconds(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function getMediaUrl(url?: string): string {
  if (!url) return "";
  if (url.startsWith("blob:")) {
    return url;
  }
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const cleanBase = apiBase.endsWith("/") ? apiBase.slice(0, -1) : apiBase;
  const cleanPath = url.startsWith("/") ? url : `/${url}`;

  // If already an absolute external URL (e.g. Cloudinary CDN)
  if (url.startsWith("http://") || url.startsWith("https://")) {
    if (!url.startsWith(cleanBase)) {
      return url;
    }
  }

  const fullUrl = (url.startsWith("http://") || url.startsWith("https://")) ? url : `${cleanBase}${cleanPath}`;

  // If pointing to backend protected media route, attach auth token for video player & download
  const token = typeof window !== "undefined" ? localStorage.getItem("clipcraft_token") : null;
  if (token && fullUrl.includes("/api/media/") && !fullUrl.includes("token=")) {
    const sep = fullUrl.includes("?") ? "&" : "?";
    return `${fullUrl}${sep}token=${encodeURIComponent(token)}`;
  }

  return fullUrl;
}
