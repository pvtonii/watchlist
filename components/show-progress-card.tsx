"use client";

import Image from "next/image";
import Link from "next/link";
import { Tv } from "lucide-react";
import { tmdbPoster } from "@/lib/config";
import ProgressBar from "@/components/progress-bar";

export default function ShowProgressCard({
  href,
  title,
  posterPath,
  seen,
  total,
  nextLabel,
  width,
  compact = false,
  color,
}: {
  href: string;
  title: string;
  posterPath: string | null;
  seen: number;
  total: number;
  /** e.g. "S2E5 up next" */
  nextLabel?: string;
  /** Fixed width for horizontal rows; omit for fluid width in grids. */
  width?: number;
  /** Poster + progress bar only — no title/caption below (dense "haven't seen" rows). */
  compact?: boolean;
  /** Override the progress bar's default brand color, e.g. show air status. */
  color?: string;
}) {
  const poster = tmdbPoster(posterPath, "w342");

  return (
    <Link
      href={href}
      className="block shrink-0"
      style={width ? { width } : undefined}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-secondary">
        {poster ? (
          <Image
            src={poster}
            alt={title}
            fill
            sizes={width ? `${width}px` : "25vw"}
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Tv size={28} />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0">
          <ProgressBar value={seen} max={total} flush color={color} />
        </div>
      </div>
      {!compact && (
        <>
          <p className="mt-1.5 line-clamp-2 text-xs leading-tight font-semibold">
            {title}
          </p>
          {nextLabel && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">{nextLabel}</p>
          )}
        </>
      )}
    </Link>
  );
}
