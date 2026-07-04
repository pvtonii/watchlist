"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import Topbar from "@/components/topbar";
import RefreshButton from "@/components/refresh-button";
import { Button } from "@/components/ui/button";
import { getSupabase } from "@/lib/supabase/client";
import { useLibrary, useWatchedEpisodes } from "@/lib/hooks";
import { APP_NAME, APP_VERSION, APP_RELEASE_DATE } from "@/lib/config";

export default function ProfilePage() {
  const router = useRouter();
  const { data: library } = useLibrary();
  const { data: watched } = useWatchedEpisodes();

  const { data: email } = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => {
      const { data } = await getSupabase().auth.getUser();
      return data.user?.email ?? "";
    },
  });

  const moviesWatched =
    library?.filter((i) => i.media_type === "movie" && i.status === "completed")
      .length ?? 0;
  const showsTracked =
    library?.filter((i) => i.media_type === "tv").length ?? 0;
  const episodesWatched = watched?.length ?? 0;

  async function signOut() {
    await getSupabase().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      <Topbar title="Profile" />
      <main className="content flex flex-col gap-6 pt-2">
        <div className="rounded-xl bg-card p-4">
          <p className="text-xs text-muted-foreground">Signed in as</p>
          <p className="truncate text-sm font-bold">{email || "…"}</p>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat value={episodesWatched} label="Episodes" />
          <Stat value={moviesWatched} label="Movies" />
          <Stat value={showsTracked} label="Shows" />
        </div>

        <div className="flex flex-col gap-3">
          <RefreshButton />
          <Button
            variant="secondary"
            className="h-11 w-full text-destructive"
            onClick={signOut}
          >
            <LogOut />
            Sign Out
          </Button>
        </div>

        {/* footer dinâmico: lê versão + data do lib/config.ts */}
        <footer className="mt-4 text-center text-xs text-muted-foreground">
          {APP_NAME} v{APP_VERSION} · {APP_RELEASE_DATE}
          <br />
          Data from TMDB · This product uses the TMDB API but is not endorsed
          or certified by TMDB.
        </footer>
      </main>
    </>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl bg-card p-3">
      <p className="text-xl font-extrabold text-primary">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
