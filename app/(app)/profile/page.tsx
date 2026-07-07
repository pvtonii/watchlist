"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { LogOut, Tv, Film, ListVideo, Radio, Drama } from "lucide-react";
import Topbar from "@/components/topbar";
import RefreshButton from "@/components/refresh-button";
import { Button } from "@/components/ui/button";
import { getSupabase } from "@/lib/supabase/client";
import {
  useLibrary,
  useWatchedEpisodes,
  useTvDetailsMany,
  useMovieDetailsMany,
} from "@/lib/hooks";
import { APP_NAME, APP_VERSION, APP_RELEASE_DATE, releasedEpisodeCount } from "@/lib/config";
import { fmtWatchDuration } from "@/lib/format";
import type { TvDetails } from "@/lib/tmdb-types";

/** Typical episode length TMDB gives us; most shows don't report every
 * episode's exact runtime, so this per-show average is the same
 * approximation trackers like TV Time use. */
const FALLBACK_EPISODE_MINUTES = 45;
const FALLBACK_MOVIE_MINUTES = 100;

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

  // Every episode watched, counted per show (specials included — they still
  // take time to watch, unlike the "progress" math elsewhere in the app).
  const episodeCountByShow = useMemo(() => {
    const map = new Map<number, number>();
    for (const row of watched ?? []) {
      map.set(row.tmdb_show_id, (map.get(row.tmdb_show_id) ?? 0) + 1);
    }
    return map;
  }, [watched]);
  const completedMovieIds = useMemo(
    () =>
      (library ?? [])
        .filter((i) => i.media_type === "movie" && i.status === "completed")
        .map((i) => i.tmdb_id),
    [library]
  );

  // Every TV show you've saved (any status) — needed for remaining-episode
  // math and for the top networks/genres breakdown, not just ones watched.
  const allTvItems = useMemo(
    () => (library ?? []).filter((i) => i.media_type === "tv"),
    [library]
  );
  const allTvIds = useMemo(() => allTvItems.map((i) => i.tmdb_id), [allTvItems]);

  const showDetailQueries = useTvDetailsMany(allTvIds);
  const movieDetailQueries = useMovieDetailsMany(completedMovieIds);

  const showDetailsById = useMemo(() => {
    const map = new Map<number, TvDetails>();
    for (const q of showDetailQueries) if (q.data) map.set(q.data.id, q.data);
    return map;
  }, [showDetailQueries]);

  const showMinutes = allTvIds.reduce((sum, id) => {
    const show = showDetailsById.get(id);
    if (!show) return sum;
    const episodes = episodeCountByShow.get(id) ?? 0;
    const runtimes = show.episode_run_time;
    const avgRuntime =
      runtimes && runtimes.length > 0
        ? runtimes.reduce((a, b) => a + b, 0) / runtimes.length
        : FALLBACK_EPISODE_MINUTES;
    return sum + episodes * avgRuntime;
  }, 0);

  const movieMinutes = movieDetailQueries.reduce((sum, q) => {
    if (!q.data) return sum;
    return sum + (q.data.runtime || FALLBACK_MOVIE_MINUTES);
  }, 0);

  // Episodes already out that you haven't watched yet, across every saved
  // show except Stopped (dropped) ones — season 0 specials excluded, same
  // convention as the rest of the app's progress math.
  const watchedRegularByShow = useMemo(() => {
    const map = new Map<number, number>();
    for (const row of watched ?? []) {
      if (row.season_number === 0) continue;
      map.set(row.tmdb_show_id, (map.get(row.tmdb_show_id) ?? 0) + 1);
    }
    return map;
  }, [watched]);
  const remainingEpisodes = allTvItems
    .filter((i) => i.status !== "dropped")
    .reduce((sum, item) => {
      const show = showDetailsById.get(item.tmdb_id);
      if (!show) return sum;
      const released = releasedEpisodeCount(show);
      const seen = watchedRegularByShow.get(item.tmdb_id) ?? 0;
      return sum + Math.max(0, released - seen);
    }, 0);

  // Top networks/genres across every saved show, regardless of status.
  const topNetworks = useMemo(
    () => topCounts(allTvIds, showDetailsById, (s) => s.networks.map((n) => n.name)),
    [allTvIds, showDetailsById]
  );
  const topGenres = useMemo(
    () => topCounts(allTvIds, showDetailsById, (s) => s.genres.map((g) => g.name)),
    [allTvIds, showDetailsById]
  );

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

        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={<Tv size={16} />}
            label="TV Shows"
            value={episodesWatched}
            unit={episodesWatched === 1 ? "episode" : "episodes"}
            sub={`${showsTracked} show${showsTracked === 1 ? "" : "s"}`}
            time={fmtWatchDuration(showMinutes)}
          />
          <StatCard
            icon={<Film size={16} />}
            label="Movies"
            value={moviesWatched}
            unit={moviesWatched === 1 ? "movie" : "movies"}
            sub="watched"
            time={fmtWatchDuration(movieMinutes)}
          />
        </div>

        <div className="flex items-center justify-between rounded-xl bg-card p-4">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <ListVideo size={16} />
            <span className="text-[11px] font-bold uppercase tracking-wide">
              Remaining Episodes
            </span>
          </div>
          <span className="text-2xl font-extrabold text-primary">
            {remainingEpisodes}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <TopList title="Top Networks" icon={<Radio size={16} />} items={topNetworks} />
          <TopList title="Top Genres" icon={<Drama size={16} />} items={topGenres} />
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

function StatCard({
  icon,
  label,
  value,
  unit,
  sub,
  time,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  unit: string;
  sub: string;
  time: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-card p-4">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[11px] font-bold uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="leading-none">
        <span className="text-2xl font-extrabold text-primary">{value}</span>{" "}
        <span className="text-xs font-semibold text-muted-foreground">
          {unit}
        </span>
      </p>
      <p className="text-[11px] text-muted-foreground">
        {sub} · {time} watched
      </p>
    </div>
  );
}

/** Top 3 most common values (e.g. network or genre names) across a set of shows. */
function topCounts(
  ids: number[],
  detailsById: Map<number, TvDetails>,
  pick: (show: TvDetails) => string[]
): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const id of ids) {
    const show = detailsById.get(id);
    if (!show) continue;
    for (const name of pick(show)) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => ({ name, count }));
}

function TopList({
  title,
  icon,
  items,
}: {
  title: string;
  icon: React.ReactNode;
  items: { name: string; count: number }[];
}) {
  return (
    <div className="rounded-xl bg-card p-4">
      <div className="mb-2 flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[11px] font-bold uppercase tracking-wide">
          {title}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Not enough data yet.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {items.map((it, i) => (
            <div key={it.name} className="flex items-center justify-between gap-2">
              <span className="truncate text-xs font-semibold">
                {i + 1}. {it.name}
              </span>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {it.count}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
