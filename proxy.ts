import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js 16 proxy (ex-middleware): keeps the Supabase session fresh on
 * every navigation. Auth *decisions* (redirect to /login) live in
 * app/(app)/layout.tsx; data is protected by RLS either way.
 */

// getUser() is a real network round-trip to Supabase's auth server — it's
// the recommended way to both validate the JWT and catch server-side
// revocation, but paying that latency on EVERY navigation is what made the
// app open to a long blank screen (nothing renders until this call
// resolves). We cache "already validated" for a short window in a cookie so
// rapid navigation/cold opens reuse the last check instead of blocking on
// the network again. Trade-off: a session revoked elsewhere (sign-out on
// another device, ban) can stay valid here for up to this many seconds —
// acceptable for a small personal app; shrink this if that lag ever matters.
const VALIDATION_TTL_SECONDS = 60;
const CHECKED_COOKIE = "sb-auth-checked-at";

// The cache above only helps *rapid* navigation. A cold open (the exact
// moment the user is staring at a blank screen) almost always happens after
// the TTL has expired, so it still paid the full network latency — on a
// slow connection that's the multi-second white screen. Cap the wait: if
// Supabase doesn't answer in time, let the request through on the strength
// of the (already `@supabase/ssr`-verified) session cookie alone and don't
// mark it as checked, so the next navigation retries. Data stays protected
// by RLS regardless of this check's outcome.
const NETWORK_TIMEOUT_MS = 400;

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const checkedAt = Number(request.cookies.get(CHECKED_COOKIE)?.value ?? 0);
  const isFresh = Date.now() - checkedAt < VALIDATION_TTL_SECONDS * 1000;
  const hasSessionCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));

  // Nothing to validate (logged out) or already validated recently: skip
  // the network round-trip and let the request through as-is.
  if (!hasSessionCookie || isFresh) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refreshes the auth token if expired, and validates it against Supabase —
  // raced against NETWORK_TIMEOUT_MS so a slow/cold connection can't block
  // the first paint (see comment above).
  const user = await Promise.race([
    supabase.auth.getUser().then(({ data }) => data.user),
    new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), NETWORK_TIMEOUT_MS)
    ),
  ]);

  if (user) {
    response.cookies.set(CHECKED_COOKIE, String(Date.now()), {
      maxAge: VALIDATION_TTL_SECONDS,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|api/tmdb).*)",
  ],
};
