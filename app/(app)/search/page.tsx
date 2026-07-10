"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchX, X } from "lucide-react";
import Topbar from "@/components/topbar";
import PosterCard from "@/components/poster-card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useLibrary, useTmdb } from "@/lib/hooks";
import type { TmdbSearchResponse } from "@/lib/tmdb-types";
import { itemTitle, itemYear } from "@/lib/tmdb-types";

const MEDIA_FILTERS = ["all", "tv", "movie"] as const;
type MediaFilter = (typeof MEDIA_FILTERS)[number];
const MEDIA_FILTER_LABELS: Record<MediaFilter, string> = {
  all: "All",
  tv: "TV Shows",
  movie: "Movies",
};

function readMediaFilter(params: URLSearchParams): MediaFilter {
  const value = params.get("media");
  return (MEDIA_FILTERS as readonly string[]).includes(value ?? "")
    ? (value as MediaFilter)
    : "all";
}

export default function SearchPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Query/filter are read from the URL on mount and kept in sync as they
  // change, so navigating into a result and back restores what you had
  // searched instead of resetting to a blank search (plain useState resets
  // on remount, which is what a back-navigation to this page causes).
  const [text, setText] = useState(() => searchParams.get("q") ?? "");
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>(() =>
    readMediaFilter(searchParams)
  );
  const inputRef = useRef<HTMLInputElement>(null);

  // debounce: só busca 400ms depois de parar de digitar
  useEffect(() => {
    const t = setTimeout(() => setQuery(text.trim()), 400);
    return () => clearTimeout(t);
  }, [text]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (mediaFilter !== "all") params.set("media", mediaFilter);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [query, mediaFilter, pathname, router]);

  // Dismiss the keyboard on scroll — with it open, iOS resizes the visual
  // viewport mid-scroll and the fixed bottom nav visibly drifts/follows.
  useEffect(() => {
    function blurOnScroll() {
      inputRef.current?.blur();
    }
    window.addEventListener("scroll", blurOnScroll, { passive: true });
    return () => window.removeEventListener("scroll", blurOnScroll);
  }, []);

  const { data, isFetching, error } = useTmdb<TmdbSearchResponse>(
    query.length >= 2 ? `/search?q=${encodeURIComponent(query)}` : null
  );
  const { data: library } = useLibrary();
  const libraryKeys = useMemo(
    () => new Set((library ?? []).map((i) => `${i.media_type}-${i.tmdb_id}`)),
    [library]
  );

  const filteredResults = useMemo(() => {
    const results = data?.results ?? [];
    return mediaFilter === "all"
      ? results
      : results.filter((r) => r.media_type === mediaFilter);
  }, [data, mediaFilter]);

  function clearSearch() {
    setText("");
    setQuery("");
  }

  return (
    <>
      <Topbar title="Search" />
      <main className="content pt-1">
        <div className="relative mb-3">
          <Input
            ref={inputRef}
            type="search"
            placeholder="Movies, TV shows…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
            className="h-11 pr-9"
          />
          {text.length > 0 && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2 rounded-full bg-secondary p-1">
          {MEDIA_FILTERS.map((filter) => (
            <button
              key={filter}
              onClick={() => setMediaFilter(filter)}
              className={`rounded-full py-1.5 text-xs font-bold transition-colors ${
                mediaFilter === filter
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {MEDIA_FILTER_LABELS[filter]}
            </button>
          ))}
        </div>

        {error && (
          <p className="text-sm text-destructive">{(error as Error).message}</p>
        )}

        {isFetching && filteredResults.length === 0 && (
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[2/3] w-full rounded-lg" />
            ))}
          </div>
        )}

        {!isFetching && query.length >= 2 && filteredResults.length === 0 && !error && (
          <div className="mt-10 flex flex-col items-center gap-2 text-muted-foreground">
            <SearchX size={28} />
            <p className="text-sm">No results for “{query}”</p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-x-3 gap-y-5">
          {filteredResults.map((r) => (
            <PosterCard
              key={`${r.media_type}-${r.id}`}
              id={r.id}
              mediaType={r.media_type!}
              title={itemTitle(r)}
              posterPath={r.poster_path}
              sub={`${r.media_type === "tv" ? "TV" : "Movie"}${
                itemYear(r) ? ` · ${itemYear(r)}` : ""
              }`}
              inLibrary={libraryKeys.has(`${r.media_type}-${r.id}`)}
              rating={r.vote_average}
            />
          ))}
        </div>
      </main>
    </>
  );
}
