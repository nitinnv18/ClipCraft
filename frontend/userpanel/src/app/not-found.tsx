import Link from "next/link";
import { FileQuestion, Home } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center mb-6 text-zinc-400">
        <FileQuestion className="w-8 h-8" />
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">Page Not Found</h1>
      <p className="text-sm text-zinc-400 mb-8 max-w-md">
        The page or job you are looking for does not exist or has been removed.
      </p>
      <Link href="/dashboard">
        <Button className="gap-2">
          <Home className="w-4 h-4" />
          Return to Dashboard
        </Button>
      </Link>
    </div>
  );
}
