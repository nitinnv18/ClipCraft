import React from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  loadingText?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = "primary",
  size = "md",
  isLoading = false,
  loadingText,
  disabled,
  ...props
}) => {
  const baseStyles =
    "inline-flex items-center justify-center gap-2 font-medium tracking-wide transition-colors focus:outline-none focus:ring-1 focus:ring-white disabled:opacity-50 disabled:cursor-not-allowed uppercase text-xs";

  const variants = {
    primary: "bg-amber-500 hover:bg-amber-600 text-black font-semibold border border-amber-500",
    secondary: "bg-[#1c1d22] hover:bg-[#282a30] text-gray-200 border border-[#2e323b]",
    danger: "bg-red-600 hover:bg-red-700 text-white border border-red-600",
    outline: "bg-transparent hover:bg-[#1a1c21] text-gray-300 border border-[#373b44]",
    ghost: "bg-transparent hover:bg-[#1a1c21] text-gray-400 hover:text-white border-transparent",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs h-8",
    md: "px-5 py-2.5 text-xs h-10",
    lg: "px-6 py-3.5 text-sm h-12 font-bold",
  };

  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-3.5 w-3.5 text-current" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>{loadingText || "PROCESSING..."}</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
};
