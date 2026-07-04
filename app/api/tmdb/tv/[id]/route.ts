import { tmdbFetch, tmdbErrorResponse } from "@/lib/tmdb";
import type { TvDetails } from "@/lib/tmdb-types";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  try {
    // Short revalidate: next_episode_to_air feeds the Home screen and
    // should stay fresh.
    const data = await tmdbFetch<TvDetails>(
      `/tv/${id}`,
      { append_to_response: "credits" },
      900
    );
    return Response.json(data);
  } catch (err) {
    return tmdbErrorResponse(err);
  }
}
