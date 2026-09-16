export interface PlaceholderRecord {
  id?: string;
  _placeholder?: boolean;
}

/** docs/DATA.md §3 — a record is a visible placeholder only when `_placeholder === true`. */
export function isVisiblePlaceholder(record: PlaceholderRecord): boolean {
  return record._placeholder === true;
}

/** Pure helper behind `check:production-data`'s placeholder gate — kept testable in isolation. */
export function findVisiblePlaceholders<T extends PlaceholderRecord>(records: T[]): T[] {
  return records.filter(isVisiblePlaceholder);
}
