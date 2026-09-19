import React from "react";

export const AdminLogo: React.FC<{ size?: number; className?: string }> = ({
  size = 28,
  className = "",
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      className={`flex-shrink-0 ${className}`}
    >
      {/* Solid Dark Outer Plate */}
      <rect width="32" height="32" fill="#0a0b0e" />
      <rect x="1.5" y="1.5" width="29" height="29" stroke="#ef4444" strokeWidth="2" />

      {/* Bold Geometric Admin "C" Command Block */}
      <path d="M24 7H8V25H24V20.5H13V11.5H24V7Z" fill="#ef4444" />

      {/* High-Vis Central Operational Signal */}
      <rect x="16" y="14" width="7" height="4" fill="#ffffff" />
      <rect x="18" y="15" width="3" height="2" fill="#ef4444" />
    </svg>
  );
};
