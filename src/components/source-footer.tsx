import { formatDate } from "@/lib/format/date";

/**
 * docs/DESIGN.md §6 — the small "Sources: … / Observed: …" credibility
 * component. Not the site footer (`Footer` owns that). Used wherever a mutable
 * value needs its source and observation date kept visible and reachable.
 */
interface SourceFooterProps {
  sources: readonly string[];
  observedAt: string;
  className?: string;
}

export function SourceFooter({ sources, observedAt, className = "" }: SourceFooterProps) {
  return (
    <div className={`text-metadata text-ink-soft ${className}`}>
      <span aria-hidden="true" className="mb-2 block h-0.5 w-8 bg-accent" />
      <p>Sources: {sources.join(", ")}</p>
      <p>Observed: {formatDate(observedAt)}</p>
    </div>
  );
}
