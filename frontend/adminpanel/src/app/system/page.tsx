"use client";

import React, { useEffect, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import { logger } from "@/lib/logger";
import { SystemHealthData, SystemLogEntry } from "@/types/admin";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/Button";
import { formatTime } from "@/lib/utils";
import {
  Server,
  Database,
  Layers,
  Cpu,
  Film,
  Cloud,
  FileText,
  RefreshCw,
  AlertTriangle,
  Terminal,
} from "lucide-react";

export default function AdminSystemHealthPage() {
  const [data, setData] = useState<SystemHealthData | null>(null);
  const [systemLogs, setSystemLogs] = useState<SystemLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPinging, setIsPinging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHealth = async () => {
    setIsPinging(true);
    try {
      const [healthRes, logsRes] = await Promise.allSettled([
        adminApi.getSystemHealth(),
        adminApi.getSystemLogs({ limit: 40 }),
      ]);

      if (healthRes.status === "fulfilled") {
        setData(healthRes.value);
        setError(null);
      } else {
        const errMsg =
          healthRes.reason instanceof Error
            ? healthRes.reason.message
            : "Failed to connect to backend health service";
        setError(errMsg);
        logger.error("System health ping check failed", healthRes.reason);
      }

      if (logsRes.status === "fulfilled") {
        setSystemLogs(logsRes.value.logs);
      }
    } catch (err) {
      logger.error("System health check failed", err);
      setError(err instanceof Error ? err.message : "Failed to load system diagnostics");
    } finally {
      setIsLoading(false);
      setIsPinging(false);
    }
  };

  useEffect(() => {
    loadHealth();
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      loadHealth();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading && !data && !error) {
    return (
      <div className="p-12 text-center text-xs font-mono text-gray-400">
        Pinging system services...
      </div>
    );
  }

  const s = data?.services;
  const fallbackStatus = error ? "offline" : "healthy";

  const serviceList = [
    {
      name: "FastAPI Application Server",
      category: "API & Gateway",
      icon: Server,
      status: s?.api.status || fallbackStatus,
      meta: s ? `Latency: ${s.api.latencyMs}ms &bull; v${s.api.version}` : (error ? "Offline &bull; Ping Connection Failed" : "Checking service status..."),
    },
    {
      name: "MongoDB / Memory Dual Store",
      category: "Persistence Database",
      icon: Database,
      status: s?.database.status || fallbackStatus,
      meta: s ? `Mode: ${s.database.mode} ${s.database.latencyMs ? `&bull; Ping: ${s.database.latencyMs}ms` : ""}` : (error ? "Offline &bull; Health Unreachable" : "Checking data store..."),
    },
    {
      name: "Redis Worker Dispatch Queue",
      category: "Asynchronous Queue",
      icon: Layers,
      status: s?.queue.status || fallbackStatus,
      meta: s ? `Engine: ${s.queue.mode}` : (error ? "Offline &bull; Queue Unreachable" : "Checking queue..."),
    },
    {
      name: "FFmpeg Video Processing Engine",
      category: "Video Transcoding",
      icon: Film,
      status: s?.ffmpeg.status || fallbackStatus,
      meta: s ? (s.ffmpeg.available ? "Binary Installed & Operational" : "Engine Offline") : (error ? "Offline &bull; Engine Unreachable" : "Checking engine..."),
    },
    {
      name: "Cloudinary CDN Storage",
      category: "Media Cloud",
      icon: Cloud,
      status: s?.cloudinary.status || fallbackStatus,
      meta: s ? `Bucket: ${s.cloudinary.cloudName}` : (error ? "Offline &bull; Cloud Unreachable" : "Checking storage..."),
    },
    {
      name: "Groq Llama 3.3 AI Provider",
      category: "NLP Moment Detection",
      icon: Cpu,
      status: s?.aiProvider.status || fallbackStatus,
      meta: s ? `Model: ${s.aiProvider.model}` : (error ? "Offline &bull; Provider Unreachable" : "Checking AI model..."),
    },
    {
      name: "YouTube Transcript Engine",
      category: "Transcript Parsing",
      icon: FileText,
      status: s?.transcriptEngine.status || fallbackStatus,
      meta: s ? `Engine: ${s.transcriptEngine.engine}` : (error ? "Offline &bull; Engine Unreachable" : "Checking parser..."),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#121316] border border-[#272a30] p-4">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 inline-block ${error ? "bg-red-500" : "bg-emerald-500 animate-pulse"}`}></div>
          <div>
            <h1 className="text-sm font-bold uppercase text-white font-mono">
              System Health &amp; Infrastructure Matrix
            </h1>
            <p className="text-[11px] font-mono text-gray-400">
              Environment: <span className="text-amber-400 uppercase font-bold">{data?.environment || "Unknown"}</span> &bull; Updated {data?.timestamp ? formatTime(data.timestamp) : (error ? "Check Failed" : "")}
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadHealth}
          isLoading={isPinging}
          className="flex items-center gap-1.5 font-mono text-xs"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Ping Services</span>
        </Button>
      </div>

      {/* Explicit Error Alert Banner when diagnostic ping fails */}
      {error && (
        <div className="p-4 bg-red-950/80 border border-red-800 text-red-200 text-xs font-mono flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <div>
              <span className="font-bold uppercase tracking-wider text-red-300">Diagnostic Alert: </span>
              <span>{error}</span>
            </div>
          </div>
          <Button variant="danger" size="sm" onClick={loadHealth} isLoading={isPinging} className="text-[11px]">
            Retry Diagnostic Ping
          </Button>
        </div>
      )}

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {serviceList.map((svc) => {
          const Icon = svc.icon;
          return (
            <div
              key={svc.name}
              className={`bg-[#121316] border p-5 flex flex-col justify-between ${
                error && !data ? "border-red-900/40 opacity-90" : "border-[#272a30]"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 bg-[#181a1f] border border-[#2e313b] flex items-center justify-center text-amber-400">
                    <Icon className="w-4 h-4" />
                  </div>
                  <StatusBadge status={svc.status} />
                </div>

                <span className="text-[10px] font-mono uppercase text-gray-400 block mb-1">
                  {svc.category}
                </span>

                <h3 className="text-xs font-bold uppercase text-white tracking-tight font-mono mb-2">
                  {svc.name}
                </h3>
              </div>

              <div className="pt-3 border-t border-[#1e2025] text-[10px] font-mono text-gray-300 truncate">
                {svc.meta.split("&bull;").map((part, i, arr) => (
                  <span key={i}>
                    {part.trim()}
                    {i < arr.length - 1 && <span className="text-gray-500 mx-1.5">•</span>}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* System Telemetry & Event Stream (Integrated getSystemLogs) */}
      <div className="bg-[#121316] border border-[#272a30] p-5">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#22252c]">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-amber-500" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
              System Service Telemetry Logs
            </h2>
          </div>
          <span className="text-[10px] font-mono text-gray-400">
            {systemLogs.length} Events In Buffer
          </span>
        </div>

        {systemLogs.length === 0 ? (
          <div className="p-6 bg-[#0d0e11] border border-[#202228] text-center font-mono text-xs text-gray-500">
            {error ? "No telemetry available while service is unreachable." : "No live system log events recorded yet."}
          </div>
        ) : (
          <div className="p-3 bg-[#0d0e11] border border-[#202228] flex flex-col gap-2 font-mono text-xs max-h-[300px] overflow-y-auto">
            {systemLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-2.5">
                <span className="text-gray-500 text-[10px] flex-shrink-0 mt-0.5">
                  {log.timestamp ? formatTime(log.timestamp) : ""}
                </span>
                <span
                  className={`px-1.5 py-0.2 text-[9px] font-bold uppercase ${
                    log.level === "ERROR" || log.level === "CRITICAL"
                      ? "bg-red-950 text-red-400 border border-red-800"
                      : log.level === "WARNING"
                      ? "bg-amber-950 text-amber-400 border border-amber-800"
                      : "bg-[#181a20] text-gray-300 border border-[#2b2e38]"
                  }`}
                >
                  {log.level}
                </span>
                <span className="text-amber-400 text-[10px] font-semibold flex-shrink-0">
                  [{log.service}]
                </span>
                <span className="text-gray-200">{log.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
