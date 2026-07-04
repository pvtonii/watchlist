"use client";

import Image from "next/image";
import Link from "next/link";
import { Film } from "lucide-react";
import { tmdbPoster } from "@/lib/config";
import type { MediaType } from "@/lib/tmdb-types";

export default function PosterCard({
  id,
  mediaType,
  title,
  posterPath,
  sub,
  width,
}: {
  id: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
  sub?: string;
  /** Fixed width for horizontal rows; omit for fluid width in grids. */
  width?: number;
}) {
  const poster = tmdbPoster(posterPath);

  return (
    <Link
      href={`/${mediaType}/${id}`}
      className="block shrink-0"
      style={width ? { width } : undefined}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-secondary">
        {poster ? (
          <Image
            src={poster}
            alt={title}
            fill
            sizes={width ? `${width}px` : "33vw"}
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Film size={28} />
          </div>
        )}
      </div>
      <p className="mt-1.5 line-clamp-2 text-xs leading-tight font-semibold">
        {title}
      </p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </Link>
  );
}
