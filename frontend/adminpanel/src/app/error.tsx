"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { logger } from "@/lib/logger";

export default function AdminErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("Adminpanel Unhandled Error:", error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6 text-red-400">
        <AlertCircle className="w-8 h-8" />
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">Admin View Encountered an Error</h1>
      <p className="text-sm text-zinc-400 mb-8 max-w-md">
        An error occurred while loading this administrative view. System logs and audit trails remain secure.
      </p>
      <div className="flex items-center gap-3">
        <Button onClick={() => reset()} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Reload Component
        </Button>
        <Link href="/dashboard">
          <Button variant="secondary" className="gap-2">
            <ShieldAlert className="w-4 h-4" />
            Admin Overview
          </Button>
        </Link>
      </div>
    </div>
  );
}
