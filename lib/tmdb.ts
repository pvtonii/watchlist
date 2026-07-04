import { z } from "zod";

/**
 * Server-side TMDB client. The API key never reaches the browser —
 * pages call our /api/tmdb/* route handlers, which call this.
 *
 * TMDB_API_KEY accepts either flavor of TMDB credential:
 * - v4 Read Access Token (long, starts with "eyJ") → sent as Bearer header
 * - v3 API key (32-char hex) → sent as api_key query param
 */
const TMDB_BASE = "https://api.themoviedb.org/3";

const envSchema = z.object({
  TMDB_API_KEY: z
    .string({ error: "TMDB_API_KEY is missing — set it in .env.local" })
    .min(10, "TMDB_API_KEY looks too short — check .env.local"),
});

export async function tmdbFetch<T>(
  path: string,
  params: Record<string, string> = {},
  revalidate = 3600
): Promise<T> {
  const { TMDB_API_KEY } = envSchema.parse({
    TMDB_API_KEY: process.env.TMDB_API_KEY,
  });

  const url = new URL(TMDB_BASE + path);
  url.searchParams.set("language", "en-US");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const headers: Record<string, string> = { accept: "application/json" };
  if (TMDB_API_KEY.startsWith("eyJ")) {
    headers.Authorization = `Bearer ${TMDB_API_KEY}`;
  } else {
    url.searchParams.set("api_key", TMDB_API_KEY);
  }

  const res = await fetch(url, { headers, next: { revalidate } });
  if (!res.ok) {
    throw new Error(`TMDB ${res.status} on ${path}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

export function tmdbErrorResponse(err: unknown) {
  const message = err instanceof Error ? err.message : "TMDB request failed";
  return Response.json({ error: message }, { status: 500 });
}
