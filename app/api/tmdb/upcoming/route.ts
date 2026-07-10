import { tmdbFetch, tmdbErrorResponse } from "@/lib/tmdb";
import { AVAILABILITY_REGION } from "@/lib/config";
import type { TmdbListItem, UpcomingMoviesResponse } from "@/lib/tmdb-types";

/** How far ahead to look for "upcoming" releases. */
const WINDOW_DAYS = 120;

/**
 * Home > Movies: notable upcoming theatrical releases.
 *
 * TMDB's own `/movie/upcoming` convenience endpoint sorts by popularity with
 * no real date bound, so most of its first page turns out to already be
 * released (verified: of 20 results, only 3 had a release_date in the
 * future) — everything else got filtered out client-side, leaving almost
 * nothing to show. `/discover/movie` with an explicit date window +
 * theatrical release-type filter gives a much denser, still popularity-
 * ranked set of genuinely upcoming movies, which we then re-sort by
 * nearest release date.
 */
export async function GET() {
  try {
    const today = new Date();
    const gte = today.toISOString().slice(0, 10);
    const lte = new Date(today.getTime() + WINDOW_DAYS * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const res = await tmdbFetch<{ results: TmdbListItem[] }>(
      "/discover/movie",
      {
        sort_by: "popularity.desc",
        "primary_release_date.gte": gte,
        "primary_release_date.lte": lte,
        // 2 = limited theatrical, 3 = wide theatrical — excludes digital/TV-only.
        with_release_type: "2|3",
        region: AVAILABILITY_REGION,
      },
      1800
    );
    const movies = res.results.sort((a, b) =>
      (a.release_date ?? "").localeCompare(b.release_date ?? "")
    );
    return Response.json({ movies } satisfies UpcomingMoviesResponse);
  } catch (err) {
    return tmdbErrorResponse(err);
  }
}
