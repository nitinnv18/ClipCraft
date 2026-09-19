"use client";

import React, { useEffect, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import { SystemHealthData } from "@/types/admin";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/Button";
import {
  Activity,
  Server,
  Database,
  Layers,
  Cpu,
  Film,
  Cloud,
  FileText,
  RefreshCw,
  CheckCircle2,
  Clock,
} from "lucide-react";

export default function AdminSystemHealthPage() {
  const [data, setData] = useState<SystemHealthData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPinging, setIsPinging] = useState(false);

  const loadHealth = async () => {
    setIsPinging(true);
    try {
      const res = await adminApi.getSystemHealth();
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
      setIsPinging(false);
    }
  };

  useEffect(() => {
    loadHealth();
    const interval = setInterval(loadHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading && !data) {
    return (
      <div className="p-12 text-center text-xs font-mono text-gray-400">
        Pinging system services...
      </div>
    );
  }

  const s = data?.services;

  const serviceList = [
    {
      name: "FastAPI Application Server",
      category: "API & Gateway",
      icon: Server,
      status: s?.api.status || "healthy",
      meta: `Latency: ${s?.api.latencyMs}ms &bull; v${s?.api.version}`,
    },
    {
      name: "MongoDB / Memory Dual Store",
      category: "Persistence Database",
      icon: Database,
      status: s?.database.status || "healthy",
      meta: `Mode: ${s?.database.mode} ${s?.database.latencyMs ? `&bull; Ping: ${s?.database.latencyMs}ms` : ""}`,
    },
    {
      name: "Redis Worker Dispatch Queue",
      category: "Asynchronous Queue",
      icon: Layers,
      status: s?.queue.status || "healthy",
      meta: `Engine: ${s?.queue.mode}`,
    },
    {
      name: "FFmpeg Video Processing Engine",
      category: "Video Transcoding",
      icon: Film,
      status: s?.ffmpeg.status || "healthy",
      meta: `Path: ${s?.ffmpeg.path}`,
    },
    {
      name: "Cloudinary CDN Storage",
      category: "Media Cloud",
      icon: Cloud,
      status: s?.cloudinary.status || "healthy",
      meta: `Bucket: ${s?.cloudinary.cloudName}`,
    },
    {
      name: "Gemini 1.5 Flash AI Provider",
      category: "NLP Moment Detection",
      icon: Cpu,
      status: s?.aiProvider.status || "healthy",
      meta: `Model: ${s?.aiProvider.model}`,
    },
    {
      name: "YouTube Transcript Engine",
      category: "Transcript Parsing",
      icon: FileText,
      status: s?.transcriptEngine.status || "healthy",
      meta: `Engine: ${s?.transcriptEngine.engine}`,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#121316] border border-[#272a30] p-4">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-emerald-500 inline-block animate-pulse"></div>
          <div>
            <h1 className="text-sm font-bold uppercase text-white font-mono">
              System Health &amp; Infrastructure Matrix
            </h1>
            <p className="text-[11px] font-mono text-gray-400">
              Environment: <span className="text-amber-400 uppercase font-bold">{data?.environment}</span> &bull; Updated {data?.timestamp ? new Date(data.timestamp).toLocaleTimeString() : ""}
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

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {serviceList.map((svc) => {
          const Icon = svc.icon;
          return (
            <div
              key={svc.name}
              className="bg-[#121316] border border-[#272a30] p-5 flex flex-col justify-between"
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

              <div
                className="pt-3 border-t border-[#1e2025] text-[10px] font-mono text-gray-300 truncate"
                dangerouslySetInnerHTML={{ __html: svc.meta }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
