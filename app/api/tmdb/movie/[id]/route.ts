import { tmdbFetch, tmdbErrorResponse } from "@/lib/tmdb";
import type { MovieDetails } from "@/lib/tmdb-types";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  try {
    const data = await tmdbFetch<MovieDetails>(`/movie/${id}`, {
      append_to_response: "credits",
    });
    return Response.json(data);
  } catch (err) {
    return tmdbErrorResponse(err);
  }
}
