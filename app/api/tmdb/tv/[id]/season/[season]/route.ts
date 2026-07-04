import { tmdbFetch, tmdbErrorResponse } from "@/lib/tmdb";
import type { SeasonDetails } from "@/lib/tmdb-types";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string; season: string }> }
) {
  const { id, season } = await ctx.params;
  try {
    const data = await tmdbFetch<SeasonDetails>(`/tv/${id}/season/${season}`);
    return Response.json(data);
  } catch (err) {
    return tmdbErrorResponse(err);
  }
}
