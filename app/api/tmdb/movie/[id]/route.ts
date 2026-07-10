import { tmdbFetch, tmdbErrorResponse } from "@/lib/tmdb";
import type { MovieDetails } from "@/lib/tmdb-types";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  try {
    // TMDB returns providers under the literal key "watch/providers" — pull
    // it out and re-key it to `watch_providers` so nothing downstream has to
    // touch a key with a slash in it.
    const raw = await tmdbFetch<
      MovieDetails & { "watch/providers"?: MovieDetails["watch_providers"] }
    >(`/movie/${id}`, {
      append_to_response: "credits,watch/providers,release_dates",
    });
    const { "watch/providers": watchProviders, ...rest } = raw;
    const data: MovieDetails = { ...rest, watch_providers: watchProviders };
    return Response.json(data);
  } catch (err) {
    return tmdbErrorResponse(err);
  }
}
