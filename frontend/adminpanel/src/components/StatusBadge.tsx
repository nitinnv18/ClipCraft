import React from "react";
import { cn } from "@/lib/utils";

type StatusType =
  | "active"
  | "suspended"
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled"
  | "healthy"
  | "degraded"
  | "down"
  | "warning"
  | "info"
  | "SUPER_ADMIN"
  | "ADMIN"
  | "SUPPORT";

interface StatusBadgeProps {
  status: StatusType | string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const norm = (status || "").toLowerCase();

  let styles = "bg-[#1f2127] text-gray-300 border-[#30333d]";
  let dotColor = "bg-gray-400";

  if (norm === "active" || norm === "completed" || norm === "healthy") {
    styles = "bg-[#13241b] text-emerald-400 border-emerald-800";
    dotColor = "bg-emerald-500";
  } else if (norm === "suspended" || norm === "failed" || norm === "down" || norm === "cancelled" || norm === "error") {
    styles = "bg-[#281418] text-rose-400 border-rose-900";
    dotColor = "bg-rose-500";
  } else if (norm === "processing" || norm === "queued" || norm === "degraded" || norm === "warning") {
    styles = "bg-[#251d10] text-amber-400 border-amber-800";
    dotColor = "bg-amber-500";
  } else if (norm === "super_admin") {
    styles = "bg-[#21162b] text-purple-400 border-purple-800";
    dotColor = "bg-purple-500";
  } else if (norm === "admin") {
    styles = "bg-[#141d2b] text-blue-400 border-blue-800";
    dotColor = "bg-blue-500";
  } else if (norm === "support") {
    styles = "bg-[#172023] text-cyan-400 border-cyan-800";
    dotColor = "bg-cyan-500";
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 border text-[10px] font-mono uppercase font-bold tracking-wider",
        styles,
        className
      )}
    >
      <span className={cn("w-1.5 h-1.5 inline-block", dotColor)} />
      <span>{status}</span>
    </span>
  );
};
