"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/context/AdminAuthContext";

export default function AdminRootPage() {
  const router = useRouter();
  const { admin, isLoading } = useAdminAuth();

  useEffect(() => {
    if (!isLoading) {
      if (admin) {
        router.replace("/dashboard");
      } else {
        router.replace("/login");
      }
    }
  }, [admin, isLoading, router]);

  return (
    <div className="flex-1 flex items-center justify-center p-8 text-xs font-mono text-gray-400">
      Directing to Admin Console...
    </div>
  );
}
