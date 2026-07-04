"use client";

import Image from "next/image";
import { User } from "lucide-react";
import { tmdbProfile } from "@/lib/config";
import type { CastMember } from "@/lib/tmdb-types";

export default function CastRow({ cast }: { cast: CastMember[] }) {
  if (cast.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 text-base font-bold">Cast</h2>
      <div className="hscroll">
        {cast.slice(0, 12).map((person) => {
          const photo = tmdbProfile(person.profile_path);
          return (
            <div key={person.id} className="w-[76px] shrink-0 text-center">
              <div className="relative mx-auto h-[64px] w-[64px] overflow-hidden rounded-full bg-secondary">
                {photo ? (
                  <Image
                    src={photo}
                    alt={person.name}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <User size={22} />
                  </div>
                )}
              </div>
              <p className="mt-1.5 line-clamp-2 text-[11px] leading-tight font-semibold">
                {person.name}
              </p>
              <p className="line-clamp-1 text-[10px] text-muted-foreground">
                {person.character}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
