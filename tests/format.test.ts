import { describe, expect, it } from "vitest";
import { formatCompactNumber, formatCount } from "../src/lib/format/number";
import { formatDate } from "../src/lib/format/date";

describe("formatCompactNumber", () => {
  it("formats millions with at most one decimal", () => {
    expect(formatCompactNumber(18_700_000)).toBe("18.7M");
  });

  it("drops a trailing .0", () => {
    expect(formatCompactNumber(5_000_000)).toBe("5M");
  });

  it("formats thousands", () => {
    expect(formatCompactNumber(4_500)).toBe("4.5K");
  });

  it("leaves sub-1000 values as a plain integer", () => {
    expect(formatCompactNumber(942)).toBe("942");
  });
});

describe("formatCount", () => {
  it("formats a small integer with no grouping needed", () => {
    expect(formatCount(42)).toBe("42");
  });

  it("groups large integers with commas", () => {
    expect(formatCount(36_669_500)).toBe("36,669,500");
  });
});

describe("formatDate", () => {
  it("formats an ISO date as an uppercase editorial label", () => {
    expect(formatDate("2026-09-15")).toBe("SEP 15 2026");
  });

  it("formats a full ISO timestamp using only its date portion", () => {
    expect(formatDate("2026-01-05T18:30:00Z")).toBe("JAN 5 2026");
  });

  it("throws on a malformed date", () => {
    expect(() => formatDate("not-a-date")).toThrow();
  });
});
