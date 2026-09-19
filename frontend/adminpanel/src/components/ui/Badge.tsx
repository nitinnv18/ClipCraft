import React from "react";
import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "queued" | "processing" | "completed" | "failed" | "neutral" | "score";
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  className,
  variant = "neutral",
  ...props
}) => {
  const variants = {
    queued: "bg-[#1f2228] text-gray-300 border border-[#373b45]",
    processing: "bg-amber-950 text-amber-300 border border-amber-600",
    completed: "bg-emerald-950 text-emerald-300 border border-emerald-600",
    failed: "bg-rose-950 text-rose-300 border border-rose-600",
    neutral: "bg-[#181a1e] text-gray-400 border border-[#2b2e36]",
    score: "bg-white text-black font-bold border border-white",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};
