import { tmdbFetch, tmdbErrorResponse } from "@/lib/tmdb";
import type { TmdbListItem, UpcomingMoviesResponse } from "@/lib/tmdb-types";

/** Home > Movies: upcoming theatrical/streaming releases from TMDB. */
export async function GET() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const res = await tmdbFetch<{ results: TmdbListItem[] }>(
      "/movie/upcoming",
      {},
      1800
    );
    const movies = res.results
      .filter((m) => (m.release_date ?? "") >= today)
      .sort((a, b) => (a.release_date ?? "").localeCompare(b.release_date ?? ""));
    return Response.json({ movies } satisfies UpcomingMoviesResponse);
  } catch (err) {
    return tmdbErrorResponse(err);
  }
}
