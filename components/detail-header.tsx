"use client";

import Image from "next/image";
import { Film } from "lucide-react";
import { tmdbPoster } from "@/lib/config";

export default function DetailHeader({
  title,
  posterPath,
  lines,
}: {
  title: string;
  posterPath: string | null;
  lines: string[];
}) {
  const poster = tmdbPoster(posterPath);
  return (
    <div className="flex gap-4">
      <div className="relative aspect-[2/3] w-28 shrink-0 overflow-hidden rounded-xl bg-secondary">
        {poster ? (
          <Image
            src={poster}
            alt={title}
            fill
            sizes="112px"
            className="object-cover"
            priority
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Film size={28} />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 self-center">
        <h1 className="text-xl leading-tight font-extrabold">{title}</h1>
        {lines.map((line, i) => (
          <p key={i} className="mt-1 text-xs text-muted-foreground">
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}
