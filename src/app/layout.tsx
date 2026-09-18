import type { Metadata } from "next";
import { Manrope, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Manrope: 700 for headlines, 400/500 for body — docs/DESIGN.md §4.
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

// IBM Plex Mono: metadata, timestamps, technical/archive labels only — never long paragraphs.
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

/**
 * docs/HOMEPAGE.md §16 fixes the homepage's title and description verbatim.
 * `title.default` reproduces that exact string for `/`, which has no `page.tsx`
 * metadata of its own and so always falls back to this default — `template`
 * only applies to a route that sets its own (short) `title`, letting every
 * other route (`/archive`, `/evidence`, `/methodology`, `/about`) keep the
 * same "<Page> — LayoffHedge Attention Index" shape without repeating the
 * suffix in five places. No `metadataBase` and no OG image here: both need an
 * absolute canonical URL that does not exist yet (docs/WORKPLAN.md B6 scope,
 * deferred to B9 — open question 6, deployment target unconfirmed).
 */
const SITE_NAME = "LayoffHedge Attention Index";
const HOMEPAGE_TITLE = `${SITE_NAME} — Independent Public Record`;
const HOMEPAGE_DESCRIPTION =
  "An independent, open-source record of LayoffHedge's public reach, viral posts, media references, and real-world amplification.";

export const metadata: Metadata = {
  title: {
    default: HOMEPAGE_TITLE,
    template: `%s — ${SITE_NAME}`,
  },
  description: HOMEPAGE_DESCRIPTION,
  openGraph: {
    title: HOMEPAGE_TITLE,
    description: HOMEPAGE_DESCRIPTION,
    type: "website",
    siteName: SITE_NAME,
  },
  twitter: {
    card: "summary_large_image",
    title: HOMEPAGE_TITLE,
    description: HOMEPAGE_DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${manrope.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
