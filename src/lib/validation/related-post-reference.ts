export interface DanglingReference {
  id: string | undefined;
  related_post_id: string;
}

/**
 * docs/DATA.md §12 — `related_post_id` must reference an existing post when not
 * null. A single-file Zod schema cannot express this (it needs `posts.json`'s ID
 * set), so it lives here as a pure, independently testable function used by both
 * `scripts/validate-data.ts` and the test suite.
 */
export function findDanglingRelatedPostIds<
  T extends { id?: string; related_post_id: string | null },
>(records: T[], validPostIds: ReadonlySet<string>): DanglingReference[] {
  const dangling: DanglingReference[] = [];
  for (const record of records) {
    if (record.related_post_id !== null && !validPostIds.has(record.related_post_id)) {
      dangling.push({ id: record.id, related_post_id: record.related_post_id });
    }
  }
  return dangling;
}
