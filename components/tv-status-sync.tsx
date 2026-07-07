"use client";

import { useSyncTvStatuses } from "@/lib/hooks";

/** Renders nothing — just runs the Watching/Completed status reconciliation
 * (see useSyncTvStatuses) once per app load. */
export default function TvStatusSync() {
  useSyncTvStatuses();
  return null;
}
