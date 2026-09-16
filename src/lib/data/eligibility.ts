/**
 * Public inclusion rule, everywhere (docs/DATA.md §3):
 * `status === "verified" && _placeholder !== true`.
 * One definition shared by every loader's `getVerified*` function.
 */
type VerifiableRecord = { status: string; _placeholder?: boolean };

export function isVerifiedRecord<T extends VerifiableRecord>(record: T): boolean {
  return record.status === "verified" && record._placeholder !== true;
}
