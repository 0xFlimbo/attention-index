import type { MediaCitedWork } from "@/schemas/media.schema";

/**
 * docs/DATA.md §7 — the stored `cited_work` value as the reader's words.
 * Storage is an enum because free text does not aggregate; this is the one
 * place that turns the enum back into English, so the same work is never
 * described two ways on two pages.
 *
 * The labels are descriptions of a thing, never a claim about it
 * (docs/EDITORIAL.md): "the H-1B filings data", never "the flagship H-1B
 * product". `none` has no label — a reference that names no work is described
 * in the sentence that counts it, not given a name of its own — so callers
 * take the `null` and write the absence in their own prose.
 */
const CITED_WORK_LABELS: Record<MediaCitedWork, string | null> = {
  layoff_data: "the layoff data",
  h1b_data: "the H-1B filings data",
  investigation: "an investigation",
  none: null,
};

/** `"h1b_data"` → `"the H-1B filings data"`; `"none"` → `null`. */
export function formatCitedWork(work: MediaCitedWork): string | null {
  return CITED_WORK_LABELS[work];
}
