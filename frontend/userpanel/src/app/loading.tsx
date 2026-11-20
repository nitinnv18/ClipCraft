import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6">
      <Loader2 className="w-8 h-8 text-amber-400 animate-spin mb-4" />
      <p className="text-sm text-zinc-400">Loading ClipCraft workspace...</p>
    </div>
  );
}
