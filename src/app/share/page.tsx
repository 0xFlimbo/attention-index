import type { Metadata } from "next";
import { ogImageDescriptor, twitterImageDescriptor } from "@/lib/og-image-meta";
import { getAmplifications, getMediaReferences, getPosts, getProjectMetadata } from "@/lib/data";
import { selectShareCards, shareIntentUrl } from "@/lib/metrics/share-cards";
import { SITE_URL } from "@/lib/site-url";
import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";
import { ShareCard } from "@/components/share-card";

/**
 * docs/ENGINEERING.md §6 — route metadata, with the explicit `images` pointer
 * every route that declares its own `openGraph`/`twitter` object repeats (see
 * src/app/archive/page.tsx for why inheritance does not reach it).
 */
const TITLE = "Share";
const DESCRIPTION =
  "Figures about LayoffHedge's public attention, each derived from verified records, dated, linked to its evidence and ready to post on X.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: `${TITLE} — LayoffHedge Attention Index`,
    description: DESCRIPTION,
    type: "website",
    siteName: "LayoffHedge Attention Index",
    images: [ogImageDescriptor],
  },
  twitter: {
    card: "summary_large_image",
    title: `${TITLE} — LayoffHedge Attention Index`,
    description: DESCRIPTION,
    images: [twitterImageDescriptor],
  },
};

/**
 * docs/HOMEPAGE.md §18 — the share cards. Thin composition: the selectors
 * decide which cards exist and what they say; this page lays them out.
 */
export default function SharePage() {
  const project = getProjectMetadata();
  const account = project.official_x_account;
  const cards = selectShareCards({
    posts: getPosts(),
    amplifications: getAmplifications(),
    mediaReferences: getMediaReferences(),
    officialXAccount: account,
  });

  return (
    <div>
      <Navigation repositoryUrl={project.repository_url} />
      <main className="container-editorial section-padding">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-ink">
          The record, <span className="text-accent">ready to post.</span>
        </h1>
        <p className="text-body mt-6 max-w-prose text-ink-soft">
          Each card is one figure derived from the verified records, with the date it holds for and
          a link to its evidence. Post on X opens a pre-filled post, which can be edited before it
          is published.
        </p>
        <p className="text-metadata mt-6 text-ink-soft">{project.disclaimer}</p>

        {cards.length > 0 ? (
          <ul className="mt-12 grid grid-cols-1 gap-x-6 md:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => (
              <ShareCard key={card.id} card={card} intentUrl={shareIntentUrl(card, account, SITE_URL)} />
            ))}
          </ul>
        ) : (
          <p className="text-body mt-12 text-ink-soft">No verified records yet.</p>
        )}
      </main>
      <Footer project={project} />
    </div>
  );
}
