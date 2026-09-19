import React from "react";
import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  className,
  id,
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <div className="w-full flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          "w-full bg-[#141518] text-gray-100 placeholder-gray-500 border border-[#2b2e36] px-3.5 py-2.5 text-sm focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-colors disabled:bg-[#0e0f11] disabled:text-gray-600",
          error && "border-red-500 focus:border-red-500 focus:ring-red-500",
          className
        )}
        {...props}
      />
      {error && <span className="text-[11px] text-red-400 font-medium">{error}</span>}
      {helperText && !error && <span className="text-[11px] text-gray-500">{helperText}</span>}
    </div>
  );
};
