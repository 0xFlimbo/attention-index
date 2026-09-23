import { ogImageAlt, ogImageContentType, ogImageSize } from "@/lib/og-image-meta";
import { renderOgImage } from "@/lib/og-image";

/**
 * Next.js file convention for `twitter:image` — a separate convention from
 * `opengraph-image.tsx`, even though this project wants the identical
 * artwork for both (`src/lib/og-image.tsx` holds the one render function).
 * Every route's metadata already sets `twitter: { card: "summary_large_image" }`
 * already; this is what makes that promise honest, root-level like
 * its Open Graph counterpart so it covers all five routes.
 */
export const alt = ogImageAlt;
export const size = ogImageSize;
export const contentType = ogImageContentType;

export default function Image() {
  return renderOgImage();
}
