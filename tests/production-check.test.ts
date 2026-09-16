import { describe, expect, it } from "vitest";
import { findVisiblePlaceholders, isVisiblePlaceholder } from "../src/lib/validation/placeholder";

describe("placeholder detection", () => {
  it("flags a record with _placeholder: true", () => {
    expect(isVisiblePlaceholder({ id: "post-a", _placeholder: true })).toBe(true);
  });

  it("does not flag a record without the flag", () => {
    expect(isVisiblePlaceholder({ id: "post-a" })).toBe(false);
    expect(isVisiblePlaceholder({ id: "post-a", _placeholder: false })).toBe(false);
  });

  it("filters a mixed list down to only the visible placeholders", () => {
    const records = [
      { id: "post-a" },
      { id: "post-b", _placeholder: true },
      { id: "post-c", _placeholder: false },
    ];
    expect(findVisiblePlaceholders(records)).toEqual([{ id: "post-b", _placeholder: true }]);
  });
});
