"use client";

import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { useState } from "react";

// Cold PWA opens (icon tapped after the app's been closed a while) always
// paid a full network round-trip before Home could paint anything — no
// local cache to fall back on meanwhile. Persisting the query cache to
// localStorage lets Home render the last-known library/watched-episodes
// instantly, while react-query refetches in the background.
const PERSIST_MAX_AGE = 24 * 60 * 60 * 1000; // 24h — must cover gcTime below

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: PERSIST_MAX_AGE,
            retry: 1,
            refetchOnWindowFocus: true,
          },
        },
      })
  );

  // createSyncStoragePersister no-ops when `storage` is undefined, so this
  // is safe during SSR (no window) — same component tree on server and
  // client, no hydration mismatch.
  const [persister] = useState(() =>
    createSyncStoragePersister({
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      key: "watchlist-cache",
    })
  );

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: PERSIST_MAX_AGE,
        // Only the small, frequently-read queries — not the many /tmdb/*
        // detail lookups (Home/Library can fetch dozens of those; they'd
        // bloat localStorage for little benefit given TMDB itself is fast).
        dehydrateOptions: {
          shouldDehydrateQuery: (query) =>
            query.queryKey[0] === "library" ||
            query.queryKey[0] === "watched-episodes",
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
