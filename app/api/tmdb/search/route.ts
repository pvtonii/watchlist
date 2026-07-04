import { NextRequest } from "next/server";
import { z } from "zod";
import { tmdbFetch, tmdbErrorResponse } from "@/lib/tmdb";
import type { TmdbListItem, TmdbSearchResponse } from "@/lib/tmdb-types";

const querySchema = z.object({ q: z.string().trim().min(1).max(200) });

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({
    q: request.nextUrl.searchParams.get("q") ?? "",
  });
  if (!parsed.success) {
    return Response.json({ error: "Missing ?q=" }, { status: 400 });
  }

  try {
    const data = await tmdbFetch<{ results: (TmdbListItem & { media_type: string })[] }>(
      "/search/multi",
      { query: parsed.data.q, include_adult: "false", page: "1" },
      300
    );
    const results = data.results.filter(
      (r) => r.media_type === "movie" || r.media_type === "tv"
    );
    return Response.json({ results } satisfies TmdbSearchResponse);
  } catch (err) {
    return tmdbErrorResponse(err);
  }
}
