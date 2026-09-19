/**
 * docs/DATA.md §7 (docs/WORKPLAN.md B13) — the `publication` field holds the
 * outlet's standard public form and nothing else (docs/EDITORIAL.md §5).
 * layoffhedge.com/press labels a republication as `Inkl (via IBTimes UK)`,
 * which is provenance written into a name: two facts in one string, neither
 * of them countable. This splits them so `provenance` / `syndicated_from`
 * can carry the second one.
 *
 * Pure and shared, like the other rules in this directory: the press importer
 * applies it to every record it builds, and the tests exercise it directly
 * rather than by running the importer.
 */
export function splitSyndicationSuffix(outlet: string): {
  publication: string;
  syndicatedFrom: string | null;
} {
  const match = /^(.*?)\s*\(via\s+([^)]+)\)\s*$/i.exec(outlet);
  if (!match) return { publication: outlet.trim(), syndicatedFrom: null };

  const publication = (match[1] ?? "").trim();
  const syndicatedFrom = (match[2] ?? "").trim();

  // A suffix that names the publication itself, or that leaves nothing on
  // either side, says nothing — and the schema rejects that pairing anyway.
  // Keep the label intact so the record is visibly odd rather than silently
  // rewritten.
  if (publication.length === 0 || syndicatedFrom.length === 0 || publication === syndicatedFrom) {
    return { publication: outlet.trim(), syndicatedFrom: null };
  }

  return { publication, syndicatedFrom };
}
