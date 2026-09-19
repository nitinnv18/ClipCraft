import React from "react";
import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "active" | "subtle";
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  variant = "default",
  ...props
}) => {
  const variants = {
    default: "bg-[#121316] border border-[#272a30]",
    active: "bg-[#16171b] border border-amber-500/80",
    subtle: "bg-[#0e0f11] border border-[#1e2025]",
  };

  return (
    <div className={cn("p-5", variants[variant], className)} {...props}>
      {children}
    </div>
  );
};
