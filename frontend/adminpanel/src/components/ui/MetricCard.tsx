"use client";

import React, { ReactNode } from "react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  className = "",
}) => {
  return (
    <div
      className={`p-5 bg-[#0d0f17] border border-neutral-800 hover:border-neutral-700 transition-colors flex flex-col justify-between ${className}`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-400">
          {title}
        </span>
        <div className="p-2 bg-[#171314] border border-red-950/80 text-red-400">
          {icon}
        </div>
      </div>

      <div>
        <div className="text-2xl font-bold font-mono text-white tracking-tight">
          {value}
        </div>
        {(subtitle || trend) && (
          <div className="mt-1 flex items-center justify-between text-[11px] font-mono text-neutral-500">
            {subtitle && <span>{subtitle}</span>}
            {trend && (
              <span
                className={trend.isPositive ? "text-emerald-400" : "text-rose-400"}
              >
                {trend.isPositive ? "+" : ""}
                {trend.value}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
