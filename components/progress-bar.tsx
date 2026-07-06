export default function ProgressBar({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  /** Override the default brand color, e.g. to flag a show's air status. */
  color?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
      <div
        className={`h-full rounded-full transition-[width] ${color ? "" : "bg-primary"}`}
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}
