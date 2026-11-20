import Link from "next/link";
import { FileQuestion, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function AdminNotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center mb-6 text-zinc-400">
        <FileQuestion className="w-8 h-8" />
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">Admin Route Not Found</h1>
      <p className="text-sm text-zinc-400 mb-8 max-w-md">
        The requested admin resource or route does not exist.
      </p>
      <Link href="/dashboard">
        <Button className="gap-2">
          <ShieldAlert className="w-4 h-4" />
          Admin Dashboard
        </Button>
      </Link>
    </div>
  );
}
