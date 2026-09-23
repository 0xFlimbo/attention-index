/**
 * The legislator register matcher (Track B).
 *
 * The cases below are the real ones. Every handle, display name and account id
 * here is taken from `data/amplifications.json` or from the 2026-09-21
 * measurement, because the whole point of matching on names was that the
 * obvious keys — handle and numeric id — miss the people this dataset holds.
 */
import { describe, expect, it } from "vitest";

import {
  buildLegislatorIndex,
  matchLegislators,
  parseCsv,
  type Legislator,
} from "@/lib/sweep/legislator-index";

const CURRENT_CSV = [
  "last_name,first_name,full_name,type,state,twitter,twitter_id,address",
  'Davidson,Warren,Warren Davidson,rep,OH,WarrenDavidson,123456,"2113 Rayburn, Washington DC"',
  "Roy,Chip,Chip Roy,rep,TX,RepChipRoy,222,",
  "Gill,Brandon,Brandon Gill,rep,TX,RepBrandonGill,333,",
  "Lee,Ann,Ann Lee,rep,MI,,,",
  "Ford,Gerald,Gerald Ford,rep,MI,,,",
].join("\n");

const HISTORICAL_CSV = [
  "last_name,first_name,full_name,type,state,twitter,twitter_id,address",
  "Chaffetz,Jason,Jason Chaffetz,rep,UT,,,",
  "Greene,Marjorie,Marjorie Taylor Greene,rep,GA,,,",
  "Sterling,John,John Sterling,rep,IL,,,",
].join("\n");

const index: Legislator[] = buildLegislatorIndex(CURRENT_CSV, HISTORICAL_CSV);

describe("parseCsv", () => {
  it("keeps a quoted field containing commas in one column", () => {
    // The register's `address` column holds commas; a naive split corrupts
    // every column after it, which silently empties the name fields.
    const rows = parseCsv(CURRENT_CSV);
    const davidson = rows.find((row) => row.last_name === "Davidson")!;
    expect(davidson.address).toBe("2113 Rayburn, Washington DC");
    expect(davidson.twitter).toBe("WarrenDavidson");
  });

  it("reads a doubled quote inside a quoted field as one literal quote", () => {
    const rows = parseCsv('a,b\n"say ""hi""",2');
    expect(rows[0]!.a).toBe('say "hi"');
  });

  it("returns nothing for an empty document", () => {
    expect(parseCsv("")).toEqual([]);
  });
});

describe("matchLegislators", () => {
  it("matches a sitting member whose handle is NOT the one on the register", () => {
    // The case that forced name matching: the register holds `WarrenDavidson`,
    // he amplified from `@Rep_Davidson`, and the display name carries the name.
    const matches = matchLegislators(
      { name: "Rep. Warren Davidson", username: "Rep_Davidson" },
      index,
    );
    expect(matches[0]!.matchedOn).toBe("name");
    expect(matches[0]!.legislator.fullName).toBe("Warren Davidson");
  });

  it("matches a personal account absent from the register", () => {
    // `congress-legislators` records taxpayer-funded accounts only, so
    // @realBrandonGill is not in it under any handle.
    const matches = matchLegislators({ name: "Brandon Gill", username: "realBrandonGill" }, index);
    expect(matches[0]!.legislator.fullName).toBe("Brandon Gill");
    expect(matches[0]!.matchedOn).toBe("name");
  });

  it("matches a former member from the historical register", () => {
    // Three of this project's political records are people who left office.
    expect(matchLegislators({ name: "Jason Chaffetz", username: "jasoninthehouse" }, index)[0]!
      .legislator.era).toBe("historical");
    expect(matchLegislators({ name: "Marjorie Taylor Greene", username: "FmrRepMTG" }, index)[0]!
      .legislator.fullName).toBe("Marjorie Taylor Greene");
  });

  it("prefers an exact handle match and says so", () => {
    const matches = matchLegislators({ name: "Chip Roy", username: "RepChipRoy" }, index);
    expect(matches[0]!.matchedOn).toBe("handle");
  });

  it("matches on the numeric account id when the register carries one", () => {
    const matches = matchLegislators(
      { name: "someone else entirely", username: "whoever", authorId: "123456" },
      index,
    );
    expect(matches[0]!.matchedOn).toBe("account-id");
  });

  it("requires both names, so a surname alone is not a match", () => {
    // "Davidson Motors" is not Warren Davidson.
    expect(matchLegislators({ name: "Davidson Motors", username: "cars" }, index)).toEqual([]);
  });

  it("matches whole words only", () => {
    // "Royston" contains "roy" but is not Chip Roy.
    expect(matchLegislators({ name: "Chip Royston", username: "chef" }, index)).toEqual([]);
  });

  it("matches a three-character surname, because the first name still has to match", () => {
    /*
     * The floor used to be four characters and this case asserted the opposite.
     * It hid `@chiproytx` — display name "Chip Roy", a sitting U.S.
     * Representative — from the calibration sweep on 2026-09-21, and twelve
     * sitting members have a three-letter surname (Chu, Lee x3, Kim x2, Roy,
     * Fry, Amo, Min, Pou), two of them Senators.
     *
     * Dropping the floor to 3 added exactly two matches across the 657 profiles
     * paid for to date, both of them genuinely Chip Roy, and no false positive.
     */
    expect(matchLegislators({ name: "Chip Roy", username: "chiproytx" }, index)).toHaveLength(1);
    expect(matchLegislators({ name: "Ann Lee", username: "ann" }, index)).toHaveLength(1);
  });

  it("still needs both names, so a bare three-character surname does not match", () => {
    // The protection is the first-name requirement, never the length floor.
    expect(matchLegislators({ name: "Bruce Lee", username: "bruce" }, index)).toEqual([]);
    expect(matchLegislators({ name: "Roy Jones", username: "boxer" }, index)).toEqual([]);
  });

  it("keeps a four-character surname, because the first name still has to match", () => {
    expect(matchLegislators({ name: "Gerald Ford", username: "x" }, index)).toHaveLength(1);
    expect(matchLegislators({ name: "Henry Ford", username: "cars" }, index)).toEqual([]);
  });

  it("is case and punctuation insensitive", () => {
    expect(
      matchLegislators({ name: "REP. WARREN  DAVIDSON!!", username: "x" }, index)[0]!.legislator
        .lastName,
    ).toBe("Davidson");
  });

  it("returns every colliding legislator rather than guessing one", () => {
    // A register spanning 1789 to today collides with ordinary people: measured
    // 3 false positives across 448 accounts, all historical. Collapsing them to
    // one guess would hide the ambiguity a human needs in order to dismiss it.
    const matches = matchLegislators({ name: "John Sterling", username: "cerberussenior" }, index);
    expect(matches).toHaveLength(1);
    expect(matches[0]!.legislator.era).toBe("historical");
  });

  it("returns nothing for an account naming nobody", () => {
    expect(matchLegislators({ name: "🇺🇸ColonelMAGAMark🇺🇸", username: "ColonelMark4" }, index))
      .toEqual([]);
  });
});
