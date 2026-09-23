/**
 * The `--urls <file>` input of `check:media-mentions`: a plain list of pages
 * that are in no file yet.
 *
 * Deliberately the dumbest format that can carry the job — one URL per line,
 * `#` comments, blank lines ignored, and anything after the URL on the same
 * line taken as a label. The web sweep writes this file; a human can also type
 * one in ten seconds, which is the point. Two throwaway scripts once existed
 * for exactly this and neither survived past that session.
 */
import { slugify } from "./raw-archive";
import type { ProbeTarget } from "./page-probe";

export interface ParsedUrlList {
  targets: ProbeTarget[];
  /** Lines that carried something but no usable URL, with their line numbers. */
  skipped: { line: number; text: string }[];
}

export function parseUrlList(contents: string): ParsedUrlList {
  const targets: ProbeTarget[] = [];
  const skipped: ParsedUrlList["skipped"] = [];
  const seen = new Set<string>();

  contents.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (line.length === 0 || line.startsWith("#")) return;

    const [url, ...rest] = line.split(/\s+/);
    if (url === undefined || !/^https?:\/\//i.test(url)) {
      skipped.push({ line: index + 1, text: line });
      return;
    }
    // A list assembled by hand or by two sweeps will repeat a URL; fetching it
    // twice is free but reports it twice, which reads as two candidates.
    if (seen.has(url)) return;
    seen.add(url);

    const label = rest.join(" ").trim();
    targets.push({
      id: targetId(url, targets.length + 1),
      publication: label.length > 0 ? label : hostOf(url),
      url,
    });
  });

  return { targets, skipped };
}

/**
 * The id names the saved text file, so it has to be unique and readable — the
 * whole claim of this tool is that a human reads the page it fetched, and
 * `url-7.txt` does not tell them which page that is.
 */
export function targetId(url: string, position: number): string {
  return `url-${String(position).padStart(2, "0")}-${slugify(hostOf(url))}`;
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "unparseable-url";
  }
}
