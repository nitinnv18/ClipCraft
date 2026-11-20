import React from "react";

export default function AdminLoading() {
  return (
    <div className="flex-1 flex flex-col gap-6 animate-pulse p-2">
      {/* Top Header skeleton */}
      <div className="flex items-center justify-between border-b border-[#24272e] pb-4">
        <div className="space-y-2">
          <div className="h-6 w-44 bg-[#181a20] rounded border border-[#24272e]" />
          <div className="h-3 w-64 bg-[#121316] rounded" />
        </div>
        <div className="h-9 w-28 bg-[#181a20] rounded border border-[#24272e]" />
      </div>

      {/* Metrics Grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-4 bg-[#0e0f12] border border-[#24272e] flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 bg-[#1f2229] rounded" />
              <div className="h-5 w-5 bg-[#1f2229] rounded" />
            </div>
            <div className="h-8 w-24 bg-[#24272e] rounded" />
            <div className="h-2 w-32 bg-[#181a20] rounded" />
          </div>
        ))}
      </div>

      {/* Content Table / Card skeleton */}
      <div className="bg-[#0e0f12] border border-[#24272e] p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-[#1f2229] pb-3">
          <div className="h-4 w-36 bg-[#1f2229] rounded" />
          <div className="h-7 w-20 bg-[#181a20] rounded" />
        </div>
        <div className="space-y-3 pt-2">
          {[1, 2, 3, 4, 5].map((row) => (
            <div
              key={row}
              className="h-11 w-full bg-[#14161b] border border-[#1f2229] flex items-center px-4 justify-between"
            >
              <div className="h-3 w-32 bg-[#22252d] rounded" />
              <div className="h-3 w-24 bg-[#22252d] rounded" />
              <div className="h-3 w-16 bg-[#22252d] rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
