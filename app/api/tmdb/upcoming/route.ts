import { tmdbFetch, tmdbErrorResponse } from "@/lib/tmdb";
import type { TmdbListItem, UpcomingResponse } from "@/lib/tmdb-types";

/** Home screen data: upcoming movie releases + TV airing in the next days. */
export async function GET() {
  try {
    const [movies, tv] = await Promise.all([
      tmdbFetch<{ results: TmdbListItem[] }>("/movie/upcoming", {}, 1800),
      tmdbFetch<{ results: TmdbListItem[] }>("/tv/on_the_air", {}, 1800),
    ]);

    const today = new Date().toISOString().slice(0, 10);
    const upcomingMovies = movies.results
      .filter((m) => (m.release_date ?? "") >= today)
      .sort((a, b) => (a.release_date ?? "").localeCompare(b.release_date ?? ""));

    return Response.json({
      movies: upcomingMovies,
      tv: tv.results,
    } satisfies UpcomingResponse);
  } catch (err) {
    return tmdbErrorResponse(err);
  }
}
