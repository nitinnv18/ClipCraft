"use client";

import React, { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  className?: string;
  render?: (item: T, index: number) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  emptyMessage?: string;
  loading?: boolean;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = "No records found.",
  loading = false,
}: DataTableProps<T>) {
  return (
    <div className="w-full border border-neutral-800 bg-[#090b10] overflow-x-auto">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-neutral-800 bg-[#0d0f17]">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`py-3 px-4 font-mono font-bold uppercase tracking-wider text-neutral-400 ${
                  col.className || ""
                }`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-900 font-mono">
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="py-8 text-center text-neutral-500">
                Loading records...
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-8 text-center text-neutral-500">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item, idx) => (
              <tr
                key={keyExtractor(item)}
                className="hover:bg-neutral-900/60 transition-colors"
              >
                {columns.map((col) => (
                  <td key={col.key} className={`py-3 px-4 text-neutral-300 ${col.className || ""}`}>
                    {col.render ? col.render(item, idx) : (item as any)[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
