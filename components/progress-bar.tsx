export default function ProgressBar({
  value,
  max,
  color,
  flush = false,
}: {
  value: number;
  max: number;
  /** Override the default brand color, e.g. to flag a show's air status. */
  color?: string;
  /** No rounded pill / no track background — for overlaying flush against a poster's bottom edge. */
  flush?: boolean;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      className={`h-1.5 w-full overflow-hidden ${flush ? "bg-black/40" : "rounded-full bg-secondary"}`}
    >
      <div
        className={`h-full transition-[width] ${flush ? "" : "rounded-full"} ${color ? "" : "bg-primary"}`}
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}
