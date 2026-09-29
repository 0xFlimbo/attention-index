import Link from "next/link";
import type { ShareCard as ShareCardData, ShareCardDateKind } from "@/lib/metrics/share-cards";
import { formatDate } from "@/lib/format/date";
import { ExternalArrow } from "./external-arrow";

const DATE_LABELS: Record<ShareCardDateKind, string> = {
  views: "VIEWS AS OF",
  data: "DATA AS OF",
  observed: "OBSERVED",
};

interface ShareCardProps {
  card: ShareCardData;
  /** `https://x.com/intent/post?…`, built by the page from the same card. */
  intentUrl: string;
}

/**
 * One card on /share (docs/HOMEPAGE.md §18): the hook, the derived figure,
 * the claim, its date and two plain links — to the evidence on this site and
 * to a pre-filled post on X. The Stat Grid cell's vocabulary (docs/DESIGN.md
 * §6): flat, a 1px border, the figure at stat-cell size in ink. No client
 * script; the post link is an ordinary link.
 *
 * The card is a list item on a four-row subgrid (hook, figure, claim with its
 * detail, links), so in a row of cards the figures and the links line up
 * whatever the length of each hook. Rows carry their own padding and the parent grid has no
 * row gap, which would otherwise open inside every card as well as between them.
 *
 * The page shows the claim, never the post text: the cashtag the post text
 * carries lives only in `intentUrl` (docs/DATA.md §10).
 */
export function ShareCard({ card, intentUrl }: ShareCardProps) {
  return (
    <li
      id={card.id}
      className="share-card row-span-4 mb-6 grid grid-rows-subgrid border border-line p-6 md:p-8"
    >
      <h2 className="text-body pb-6 font-bold text-ink">{card.hook}</h2>
      <p className="text-stat-cell tabular-nums text-ink">{card.figure}</p>
      <div className="pt-3">
        <p className="text-body text-ink">{card.claim}</p>
        {card.detail !== null && <p className="mt-3 text-sm text-ink-soft">{card.detail}</p>}
      </div>

      <div className="pt-6">
        <div className="border-t border-line pt-4">
          <p className="text-metadata text-ink-soft">
            {DATE_LABELS[card.dateKind]} {formatDate(card.asOf)}
          </p>
          <div className="text-metadata mt-3 flex flex-wrap gap-x-6 gap-y-2 font-bold">
            <Link href={card.evidenceHref} className="text-ink underline-offset-2 hover:underline">
              {card.evidenceLabel} <span aria-hidden="true">→</span>
              <span className="sr-only"> for {card.figure} {card.claim}</span>
            </Link>
            <a
              href={intentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink underline-offset-2 hover:underline"
            >
              POST ON X <ExternalArrow />
              <span className="sr-only"> — {card.figure} {card.claim} (opens in a new tab)</span>
            </a>
          </div>
        </div>
      </div>
    </li>
  );
}
