"use client";

import { useEffect, useState } from "react";
import { SearchX } from "lucide-react";
import Topbar from "@/components/topbar";
import PosterCard from "@/components/poster-card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useTmdb } from "@/lib/hooks";
import type { TmdbSearchResponse } from "@/lib/tmdb-types";
import { itemTitle, itemYear } from "@/lib/tmdb-types";

export default function SearchPage() {
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");

  // debounce: só busca 400ms depois de parar de digitar
  useEffect(() => {
    const t = setTimeout(() => setQuery(text.trim()), 400);
    return () => clearTimeout(t);
  }, [text]);

  const { data, isFetching, error } = useTmdb<TmdbSearchResponse>(
    query.length >= 2 ? `/search?q=${encodeURIComponent(query)}` : null
  );

  const results = data?.results ?? [];

  return (
    <>
      <Topbar title="Search" />
      <main className="content pt-1">
        <Input
          type="search"
          placeholder="Movies, TV shows…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
          className="mb-4 h-11"
        />

        {error && (
          <p className="text-sm text-destructive">{(error as Error).message}</p>
        )}

        {isFetching && results.length === 0 && (
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[2/3] w-full rounded-lg" />
            ))}
          </div>
        )}

        {!isFetching && query.length >= 2 && results.length === 0 && !error && (
          <div className="mt-10 flex flex-col items-center gap-2 text-muted-foreground">
            <SearchX size={28} />
            <p className="text-sm">No results for “{query}”</p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-x-3 gap-y-5">
          {results.map((r) => (
            <PosterCard
              key={`${r.media_type}-${r.id}`}
              id={r.id}
              mediaType={r.media_type!}
              title={itemTitle(r)}
              posterPath={r.poster_path}
              sub={`${r.media_type === "tv" ? "TV" : "Movie"}${
                itemYear(r) ? ` · ${itemYear(r)}` : ""
              }`}
            />
          ))}
        </div>
      </main>
    </>
  );
}
