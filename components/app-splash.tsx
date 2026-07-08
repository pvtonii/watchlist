import Image from "next/image";
import { Loader2 } from "lucide-react";
import { APP_NAME } from "@/lib/config";

/**
 * Full-screen branded loading state — shown while the app's route segments
 * render (Next.js Suspense, app/(app)/loading.tsx) and while Home waits for
 * its core data (library, watched episodes, upcoming) so the first paint is
 * one complete screen instead of skeletons popping in section by section.
 */
export default function AppSplash() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-5 bg-background">
      <div className="relative h-20 w-20 overflow-hidden rounded-[22px] shadow-lg shadow-black/40">
        <Image src="/icons/icon-192.png" alt="" fill sizes="80px" priority />
      </div>
      <p className="text-lg font-bold tracking-tight">{APP_NAME}</p>
      <Loader2 className="animate-spin text-primary" size={22} strokeWidth={2.5} />
    </div>
  );
}
