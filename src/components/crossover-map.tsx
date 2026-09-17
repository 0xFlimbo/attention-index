import type { Amplification } from "@/schemas/amplification.schema";
import { selectCrossoverCategories, type CrossoverCategoryData } from "@/lib/metrics/amplification";
import { formatCount } from "@/lib/format/number";
import { SectionEyebrow } from "./section-eyebrow";

/**
 * docs/HOMEPAGE.md §8 — Crossover (section 05). A self-contained Server
 * Component, same shape as `ViralArchive`: owns its own eyebrow/headline and
 * decides its own visibility. Renders when at least one category has a
 * verified record; `selectCrossoverCategories` already excludes zero-count
 * categories, so an empty result here is exactly "zero verified
 * amplifications" (docs/HOMEPAGE.md §2) and the whole section disappears.
 */
interface CrossoverMapProps {
  amplifications: Amplification[];
}

export function CrossoverMap({ amplifications }: CrossoverMapProps) {
  const categories = selectCrossoverCategories(amplifications);
  if (categories.length === 0) return null;

  return (
    <section id="crossover" className="container-editorial section-padding reveal-on-mount">
      <SectionEyebrow index="02" label="CROSSOVER" />
      {/*
        From `lg` up the headline and the diagram share one 12-column row
        (headline 1–5, diagram 7–12) instead of stacking. Stacked, the diagram
        was a 672px column centred in a 1376px container while the headline sat
        hard left — a narrow centred column with a void beside it, which
        docs/DESIGN.md §5 rules out for a key section ("the site should feel
        broad and spatial"). Same correction, and the same 12-column reasoning,
        as the B2 hero fix. Below `lg` the two simply stack as before.
      */}
      <div className="lg:grid lg:grid-cols-12 lg:items-center lg:gap-8">
        <div className="lg:col-span-5">
          <h2 className="text-2xl md:text-3xl mt-4 font-bold tracking-tight text-ink">
            FROM CRYPTO
            <br />
            TO CULTURE.
          </h2>
          <p className="text-body mt-4 max-w-2xl text-ink-soft">
            Publicly documented examples of LayoffHedge content being amplified outside the
            crypto-native audience.
          </p>
        </div>

        <div className="lg:col-span-6 lg:col-start-7">
          <CrossoverDiagram categories={categories} />
        </div>
      </div>

      {/*
        Accessible text equivalent (docs/DESIGN.md §7), rendered once — not a
        second copy for mobile. Below `md` the SVG above is hidden by CSS, so
        this grid is the only presentation; from `md` up it sits below the
        diagram as the required text equivalent (DESIGN §7: "always provide
        one"). The "hover reveals example names" half of docs/HOMEPAGE.md §8's
        interaction line is satisfied permanently here, not only on hover.
      */}
      <ul className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 md:mt-14 lg:grid-cols-4">
        {/*
          1px rule in the strong line colour: docs/DESIGN.md §5 sets the border
          weight at 1px, and `--color-line-strong` is a stronger colour rather
          than a thicker rule.
        */}
        {categories.map((entry) => (
          <li key={entry.category} className="border-t border-line-strong pt-4">
            <p className="text-metadata text-ink-soft">{entry.label}</p>
            <p className="text-crossover-count mt-1 tabular-nums text-ink">{formatCount(entry.count)}</p>
            {entry.examples.length > 0 && (
              <p className="text-body mt-3 text-ink-soft">{entry.examples.join(" · ")}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** SVG canvas coordinates. Fixed viewBox, scaled by the caller via `width: 100%` — never a pixel width. */
const VIEWBOX_WIDTH = 600;
const VIEWBOX_HEIGHT = 460;
const CENTER_X = VIEWBOX_WIDTH / 2;
const CENTER_Y = VIEWBOX_HEIGHT / 2;
const HUB_RADIUS = 56;
const NODE_RING_RADIUS = 140;
const LABEL_RING_RADIUS = 170;
const NODE_DOT_RADIUS = 5;

/**
 * Node positions are a pure function of `index`/`total`, evenly spaced
 * around a ring with the first node at the top (docs/HOMEPAGE.md §8: "the
 * categories that have records arranged around it"), so the diagram is
 * correct for any count from 1 to the full 8-category enum — never
 * hand-positioned for today's 4.
 */
function polarPoint(radius: number, index: number, total: number): { x: number; y: number } {
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
  return {
    x: CENTER_X + radius * Math.cos(angle),
    y: CENTER_Y + radius * Math.sin(angle),
  };
}

/** Keeps a label from overlapping the line it sits beside: grows away from the center. */
function horizontalAnchor(x: number): "start" | "middle" | "end" {
  if (Math.abs(x - CENTER_X) < 4) return "middle";
  return x > CENTER_X ? "start" : "end";
}

/** Baseline gap between a node's label and the count printed under it. */
const LABEL_TO_COUNT_GAP = 26;

/**
 * The two-line label block (label above, count below) always grows *away* from
 * the hub. For a node in the lower half that is automatic. For one in the upper
 * half it is not: drawing the count 26px below a label that already sits above
 * the node pushes the number back down onto the node dot — which is exactly
 * what the top `GOVERNMENT` node did at 768 and 1440 before this. Shifting the
 * whole block up by one line for upper nodes keeps the reading order
 * (label, then count) identical in both halves.
 */
function labelBaselineY(labelY: number): number {
  return labelY < CENTER_Y ? labelY - LABEL_TO_COUNT_GAP : labelY;
}

function CrossoverDiagram({ categories }: { categories: CrossoverCategoryData[] }) {
  const total = categories.length;

  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      className="mx-auto mt-10 hidden w-full max-w-2xl md:mt-14 md:block lg:mt-0"
    >
      {categories.map((entry, index) => {
        const node = polarPoint(NODE_RING_RADIUS, index, total);
        const label = polarPoint(LABEL_RING_RADIUS, index, total);
        const anchor = horizontalAnchor(label.x);
        const labelY = labelBaselineY(label.y);

        return (
          // No `tabIndex`: this whole graphic is `aria-hidden` and decorative —
          // the same category/count/example data is always present in the text
          // blocks below, so nothing is lost to a keyboard or screen-reader user.
          // `:focus-within` is included for parity in case that changes later.
          <g key={entry.category} className="crossover-node">
            <line
              x1={CENTER_X}
              y1={CENTER_Y}
              x2={node.x}
              y2={node.y}
              pathLength={1}
              className="crossover-connector"
            />
            <circle cx={node.x} cy={node.y} r={NODE_DOT_RADIUS} className="crossover-node-dot" />
            <text
              x={label.x}
              y={labelY}
              textAnchor={anchor}
              className="crossover-node-label text-metadata"
            >
              {entry.label}
            </text>
            <text
              x={label.x}
              y={labelY + LABEL_TO_COUNT_GAP}
              textAnchor={anchor}
              fontSize={26}
              fontWeight={700}
              className="crossover-node-count tabular-nums"
            >
              {formatCount(entry.count)}
            </text>
          </g>
        );
      })}

      {/* Hub, drawn last so it sits on top of every connector's origin point. */}
      <circle cx={CENTER_X} cy={CENTER_Y} r={HUB_RADIUS} className="crossover-hub-circle" />
      <text
        x={CENTER_X}
        y={CENTER_Y - 4}
        textAnchor="middle"
        fontSize={17}
        fontWeight={700}
        className="crossover-hub-text"
      >
        LAYOFF
      </text>
      <text
        x={CENTER_X}
        y={CENTER_Y + 16}
        textAnchor="middle"
        fontSize={17}
        fontWeight={700}
        className="crossover-hub-text"
      >
        HEDGE
      </text>
    </svg>
  );
}
