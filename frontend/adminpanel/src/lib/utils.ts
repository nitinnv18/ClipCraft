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
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("blob:")) {
    return url;
  }
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const cleanBase = apiBase.endsWith("/") ? apiBase.slice(0, -1) : apiBase;
  const cleanPath = url.startsWith("/") ? url : `/${url}`;
  return `${cleanBase}${cleanPath}`;
}

export function parseUtcDate(dateInput: string | Date | null | undefined): Date | null {
  if (!dateInput) return null;
  if (dateInput instanceof Date) return isNaN(dateInput.getTime()) ? null : dateInput;
  let s = String(dateInput).trim();
  if (!s) return null;
  if (s.includes(" ") && !s.includes("T")) {
    s = s.replace(" ", "T");
  }
  if (!s.endsWith("Z") && !/[+-]\d{2}:?\d{2}$/.test(s)) {
    s += "Z";
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDateTime(dateInput: string | Date | null | undefined): string {
  const d = parseUtcDate(dateInput);
  if (!d) return "—";
  return d.toLocaleString();
}

export function formatTime(dateInput: string | Date | null | undefined): string {
  const d = parseUtcDate(dateInput);
  if (!d) return "";
  return d.toLocaleTimeString();
}

export function formatDate(dateInput: string | Date | null | undefined): string {
  const d = parseUtcDate(dateInput);
  if (!d) return "—";
  return d.toLocaleDateString();
}
