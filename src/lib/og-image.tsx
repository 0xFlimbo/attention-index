import { ImageResponse } from "next/og";
import { getProjectMetadata } from "@/lib/data";

import { ogImageSize } from "@/lib/og-image-meta";

/**
 * docs/WORKPLAN.md B9, docs/DESIGN.md §1–3 — the Open Graph artwork, deferred
 * from B6 with `sitemap.ts`/`robots.ts` for the same reason (needed an
 * absolute canonical URL that didn't exist yet). Shared render function so
 * `src/app/opengraph-image.tsx` and `src/app/twitter-image.tsx` — Next's two
 * separate file conventions for `og:image` and `twitter:image` — produce the
 * identical artwork instead of two hand-maintained copies.
 *
 * Uses `next/og`'s built-in `ImageResponse` — no new dependency
 * (docs/ENGINEERING.md §1's dependency gate). No custom font is loaded: doing
 * so means fetching a font file at render time, which is both a network
 * dependency this static-first project avoids (`CLAUDE.md`'s engineering
 * rule) and unnecessary risk on this VPS. `ImageResponse`'s bundled default
 * sans font already reads as a plain, confident, editorial face at this size.
 *
 * Colors are the same literal hex values `globals.css` declares as design
 * tokens (docs/DESIGN.md §3) — `next/og` renders through Satori, outside
 * Tailwind/CSS-variable resolution, so the values are necessarily restated
 * here rather than imported; this is the one place in the codebase where a
 * raw brand hex value is correct, not a violation of "tokens are centralized"
 * (docs/CLAUDE.md §5).
 *
 * No token imagery, no third-party logo, no fabricated metric — the
 * disclaimer line is `project.disclaimer` itself, read from `data/project.json`
 * like every other on-site use of that field (docs/CLAUDE.md §3), never
 * retyped.
 */
const COLOR_BG = "#F2EFE9";
const COLOR_INK = "#171717";
const COLOR_INK_SOFT = "#5F5B56";
const COLOR_ACCENT = "#E34B46";
const COLOR_LINE = "#DDD7CF";

export function renderOgImage(): ImageResponse {
  const project = getProjectMetadata();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: COLOR_BG,
          fontFamily: "sans-serif",
        }}
      >
        {/* Thin red top rule — the same on-brand device as the hero's `border-t-4 border-accent` (docs/DESIGN.md §6). */}
        <div style={{ display: "flex", width: "100%", height: 8, backgroundColor: COLOR_ACCENT }} />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: "center",
            padding: "0 84px",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: COLOR_INK_SOFT,
            }}
          >
            {project.short_name}
          </div>

          {/* Headline highlight (docs/DESIGN.md §4): one phrase in red, the rest black. */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginTop: 28,
              fontSize: 84,
              fontWeight: 700,
              lineHeight: 0.98,
              letterSpacing: -3,
              color: COLOR_INK,
            }}
          >
            <div style={{ display: "flex" }}>ATTENTION IS</div>
            <div style={{ display: "flex", flexDirection: "row" }}>
              <div style={{ display: "flex" }}>THE&nbsp;</div>
              <div style={{ display: "flex", color: COLOR_ACCENT }}>ASSET.</div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 36,
              maxWidth: 980,
              fontSize: 27,
              lineHeight: 1.35,
              color: COLOR_INK_SOFT,
            }}
          >
            Independent, open-source record of LayoffHedge&apos;s public reach, viral posts, media
            references and real-world amplification.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            padding: "30px 84px",
            borderTop: `1px solid ${COLOR_LINE}`,
            fontSize: 19,
            color: COLOR_INK_SOFT,
          }}
        >
          {project.disclaimer}
        </div>
      </div>
    ),
    { ...ogImageSize },
  );
}
