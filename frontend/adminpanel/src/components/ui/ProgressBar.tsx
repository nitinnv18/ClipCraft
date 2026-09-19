import React from "react";
import { cn } from "@/lib/utils";

interface ProgressBarProps {
  progress: number;
  stage?: string;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  stage,
  className,
}) => {
  const clamped = Math.min(100, Math.max(0, progress));

  return (
    <div className={cn("w-full flex flex-col gap-2", className)}>
      <div className="flex justify-between items-center text-xs font-semibold uppercase tracking-wider text-gray-300">
        <span>{stage || "Processing"}</span>
        <span className="font-mono text-red-400">{clamped}%</span>
      </div>
      <div className="w-full h-2 bg-[#1c1d22] border border-[#2b2e36] overflow-hidden">
        <div
          className="h-full bg-red-600 transition-all duration-300 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
};
