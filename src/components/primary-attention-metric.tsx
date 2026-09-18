"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { formatCompactNumber, formatCount } from "@/lib/format/number";
import { formatDate } from "@/lib/format/date";
import { ExternalArrow } from "./external-arrow";

/**
 * docs/HOMEPAGE.md §5 — the mostly-empty section built around one very large
 * derived number. `totalObservedViews` and `trackedPostCount` come from the
 * metrics layer via page.tsx; nothing here is hardcoded.
 *
 * The number count-up (docs/DESIGN.md §8) is client-only, but the server-
 * rendered HTML already contains `formattedTotalObservedViews` as the span's
 * text — with JS disabled, or before hydration, the page shows the correct
 * final number, never 0 and never blank. After mount, on viewport entry, it
 * animates once from 0 up to the real value and then re-settles on the exact
 * same formatted string. `prefers-reduced-motion` is checked at runtime
 * before the animation is ever started, per docs/DESIGN.md §8.
 *
 * `SOURCE DATA` / `METHODOLOGY` — docs/HOMEPAGE.md §5's approved copy prints
 * both with `↗`, but `↗` is reserved sitewide for genuinely external links
 * (docs/DESIGN.md §6; the same rule `EvidenceBlock`, `ViralArchive` and
 * `PublicReferences` already apply, each with the identical comment). Fixed
 * at B9's accessibility pass: `METHODOLOGY` never leaves the site, so it is
 * `METHODOLOGY →` to `/methodology`. `SOURCE DATA` mirrors `EvidenceBlock`'s
 * `VIEW DATA` exactly — external once `repositoryUrl` is published
 * (`${repositoryUrl}/tree/main/data`, `↗`), falling back to an internal
 * `/evidence` (`→`) only while there is no repository to point at.
 */
interface PrimaryAttentionMetricProps {
  totalObservedViews: number;
  trackedPostCount: number;
  lastUpdated: string;
  repositoryUrl: string | null;
}

export function PrimaryAttentionMetric({
  totalObservedViews,
  trackedPostCount,
  lastUpdated,
  repositoryUrl,
}: PrimaryAttentionMetricProps) {
  const valueRef = useRef<HTMLSpanElement>(null);
  const hasAnimatedRef = useRef(false);
  const formattedValue = formatCompactNumber(totalObservedViews);

  useEffect(() => {
    const node = valueRef.current;
    if (node === null) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !hasAnimatedRef.current) {
            hasAnimatedRef.current = true;
            animateCount(node, totalObservedViews, formattedValue);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [totalObservedViews, formattedValue]);

  return (
    <section
      id="attention-metric"
      className="container-editorial section-padding border-b border-line"
    >
      <p>
        <span
          ref={valueRef}
          className="text-stat tabular-nums inline-block text-ink"
          style={{ minWidth: `${formattedValue.length}ch` }}
        >
          {formattedValue}
        </span>
      </p>

      <h2 className="text-metadata mt-4 text-ink-soft">
        OBSERVED VIEWS
        <br />
        ACROSS TRACKED POSTS
      </h2>

      <p className="text-body mt-6 text-ink-soft">
        Across {formatCount(trackedPostCount)} publicly tracked posts
      </p>

      <div className="text-metadata mt-10 flex flex-wrap gap-x-8 gap-y-3 text-ink-soft">
        <span>LAST UPDATED {formatDate(lastUpdated)}</span>
        {repositoryUrl !== null ? (
          <a
            href={`${repositoryUrl}/tree/main/data`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-ink underline-offset-2 hover:underline"
          >
            SOURCE DATA <ExternalArrow /><span className="sr-only"> (opens in a new tab)</span>
          </a>
        ) : (
          <Link href="/evidence" className="font-bold text-ink underline-offset-2 hover:underline">
            SOURCE DATA →
          </Link>
        )}
        <Link href="/methodology" className="font-bold text-ink underline-offset-2 hover:underline">
          METHODOLOGY →
        </Link>
      </div>
    </section>
  );
}

function animateCount(node: HTMLSpanElement, target: number, finalText: string): void {
  const durationMs = 1500;
  const start = performance.now();

  function tick(now: number): void {
    const elapsed = now - start;
    const progress = Math.min(1, elapsed / durationMs);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(target * eased);
    node.textContent = formatCompactNumber(current);

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      // Guarantee the exact final string — rounding during the animation can
      // otherwise land one unit off the real formatted value.
      node.textContent = finalText;
    }
  }

  requestAnimationFrame(tick);
}
