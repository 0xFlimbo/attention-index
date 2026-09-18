/**
 * The Open Graph image's dimensions, alt text and per-route descriptors.
 *
 * Split out of `src/lib/og-image.tsx` so a route's `metadata` can point at the
 * image without importing the renderer — that module pulls in `next/og`'s
 * `ImageResponse`, which four route modules have no reason to carry just to
 * describe a URL.
 *
 * Why the descriptors exist at all: Next applies a file-convention image only
 * to a segment that declares no `images` key of its own, and that check does
 * not cascade past a child segment which redeclares `openGraph`/`twitter` —
 * which `/archive`, `/evidence`, `/methodology` and `/about` all do, for their
 * own titles and descriptions (B6). Those four therefore repeat the pointer.
 * A bare string would resolve to a URL and nothing else, dropping
 * `og:image:width`, `height` and `alt`, so the pointer is an object: the four
 * routes emit the same complete tag set as the homepage, whose image the file
 * convention resolves for it.
 */
export const ogImageSize = { width: 1200, height: 630 };
export const ogImageContentType = "image/png";
export const ogImageAlt =
  "LayoffHedge Attention Index — an independent, open-source record of LayoffHedge's public reach, viral posts, media references and amplification.";

export const ogImageDescriptor = {
  url: "/opengraph-image",
  width: ogImageSize.width,
  height: ogImageSize.height,
  alt: ogImageAlt,
  type: ogImageContentType,
};

export const twitterImageDescriptor = {
  url: "/twitter-image",
  width: ogImageSize.width,
  height: ogImageSize.height,
  alt: ogImageAlt,
  type: ogImageContentType,
};
