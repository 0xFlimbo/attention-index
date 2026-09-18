import { ogImageAlt, ogImageContentType, ogImageSize } from "@/lib/og-image-meta";
import { renderOgImage } from "@/lib/og-image";

/**
 * Next.js file convention — `src/lib/og-image.tsx` documents the design
 * rationale. Sitting at the app root, this generates the one image every
 * route uses. The homepage resolves it through this convention; the other
 * four declare their own `openGraph`/`twitter` objects for their titles, so
 * they point at it explicitly via `ogImageDescriptor` — see
 * `src/lib/og-image-meta.ts`. No dynamic params, so Next generates this once
 * at build time — static, not per-request.
 */
export const alt = ogImageAlt;
export const size = ogImageSize;
export const contentType = ogImageContentType;

export default function Image() {
  return renderOgImage();
}
