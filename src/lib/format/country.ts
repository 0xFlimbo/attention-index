/**
 * docs/DATA.md §2 — country codes are stored as ISO 3166-1 alpha-2 and
 * "friendly names are a UI concern". This is that concern, in one place.
 *
 * The map is deliberately not an exhaustive ISO table: it holds the codes the
 * dataset actually uses plus the ones the press queue is expected to add, and
 * an unmapped code falls back to the code itself rather than to a guess or a
 * blank. A missing name is a cosmetic gap; an invented one would be a
 * fabricated fact about a publication.
 */
const COUNTRY_NAMES: Record<string, string> = {
  AE: "United Arab Emirates",
  AU: "Australia",
  BG: "Bulgaria",
  CA: "Canada",
  CH: "Switzerland",
  DE: "Germany",
  ES: "Spain",
  FR: "France",
  GB: "United Kingdom",
  IE: "Ireland",
  IL: "Israel",
  IN: "India",
  IT: "Italy",
  JP: "Japan",
  KE: "Kenya",
  NG: "Nigeria",
  NL: "Netherlands",
  NZ: "New Zealand",
  PH: "Philippines",
  SG: "Singapore",
  US: "United States",
  ZA: "South Africa",
};

/** `"GB"` → `"United Kingdom"`; an unmapped code is returned unchanged. */
export function formatCountry(code: string): string {
  return COUNTRY_NAMES[code] ?? code;
}
