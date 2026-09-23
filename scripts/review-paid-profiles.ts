/**
 * pnpm review:profiles [-- --floor N] [-- --all]
 *
 * Re-reads every profile this project has already paid for and reports the ones
 * a human should look at. **Makes no network request of any kind** — it is the
 * "the data is bought, the reading is free" pass.
 *
 * Why it exists as a script rather than a one-off: `research/` grows every sweep,
 * and the review criteria have already changed twice. A stored pass can be re-run
 * over the whole corpus whenever a criterion moves, instead of re-deciding by
 * hand which files were screened under which rule.
 *
 * Read-only against `data/`, and against every paid file in `research/`. It never
 * writes a record and never edits a file it did not create.
 *
 * It has exactly one write: `research/x-api-profiles.json`, the id-keyed index of
 * every profile already paid for, rebuilt from the research files themselves. It
 * is derived rather than authored, so it is idempotent and safe to regenerate —
 * an index of the truth, never a source of it.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { amplificationsFileSchema } from "../src/schemas/amplification.schema";
import { knownAccountKeys, signalFlags } from "../src/lib/sweep/quote-candidates";
import { collectUserObjects, mergeProfiles, type PaidProfile } from "../src/lib/sweep/profile-store";
import {
  buildLegislatorIndex,
  matchLegislators,
  type Legislator,
} from "../src/lib/sweep/legislator-index";

const ROOT = process.cwd();
const RESEARCH_DIR = resolve(ROOT, "research");
/** Shared with `sweep:quotes` — the one index of every profile already paid for. */
const PROFILE_STORE = resolve(RESEARCH_DIR, "x-api-profiles.json");

const args = process.argv.slice(2);
function flagValue(name: string): string | null {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? null : (args[index + 1] ?? null);
}

/**
 * The reading floor, inherited from Track A rather than invented here: of 210
 * authors below 5 000 followers, 16 carried a role phrase and none carried
 * weight. It applies **only** to the follower criterion — a legislator name
 * match, a `government` verified_type or a role phrase is reviewed at any size.
 */
const followerFloor = Number(flagValue("floor") ?? 5_000);
const showEverything = args.includes("--all");

/** A paid profile plus the research file it was recovered from. */
type SourcedProfile = PaidProfile & { source: string };

/** Every user object in every research file, deduplicated by account id. */
function loadPaidProfiles(): Map<string, SourcedProfile> {
  const profiles = new Map<string, SourcedProfile>();
  if (!existsSync(RESEARCH_DIR)) return profiles;

  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) return walk(path);
      return entry.isFile() && entry.name.endsWith(".json") ? [path] : [];
    });

  for (const file of walk(RESEARCH_DIR)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(file, "utf-8"));
    } catch {
      continue; // a malformed research file is not this script's problem to fix
    }
    const label = file.slice(RESEARCH_DIR.length + 1).split("\\").join("/");
    const sourced = collectUserObjects(parsed).map((profile) => ({ ...profile, source: label }));
    mergeProfiles(profiles as Map<string, PaidProfile>, sourced);
  }
  return profiles;
}

function loadLegislators(): Legislator[] {
  const dir = resolve(RESEARCH_DIR, "x-api-2026-09-20");
  const current = resolve(dir, "legislators-current.csv");
  const historical = resolve(dir, "legislators-historical.csv");
  if (!existsSync(current) || !existsSync(historical)) {
    console.error(
      "Legislator register not found. Both files are free and re-downloadable:\n" +
        "  curl -sS -o research/x-api-2026-09-20/legislators-current.csv \\\n" +
        "    https://unitedstates.github.io/congress-legislators/legislators-current.csv\n" +
        "  curl -sS -o research/x-api-2026-09-20/legislators-historical.csv \\\n" +
        "    https://unitedstates.github.io/congress-legislators/legislators-historical.csv",
    );
    process.exit(1);
  }
  return buildLegislatorIndex(readFileSync(current, "utf-8"), readFileSync(historical, "utf-8"));
}

function main(): void {
  const profiles = loadPaidProfiles();
  const legislators = loadLegislators();
  const amplifications = amplificationsFileSchema.parse(
    JSON.parse(readFileSync(resolve(ROOT, "data", "amplifications.json"), "utf-8")),
  );
  const known = knownAccountKeys(amplifications);

  console.log(
    `${profiles.size} distinct profiles already paid for · ` +
      `${legislators.length} legislators in the register · ` +
      `${known.size} accounts already known\n`,
  );

  const reviewed = [...profiles.values()].filter(
    (profile) => !known.has(`@${profile.username.toLowerCase()}`),
  );

  const rows = reviewed.map((profile) => {
    const followers = profile.public_metrics?.followers_count ?? 0;
    const matches = matchLegislators(
      { name: profile.name ?? "", username: profile.username, authorId: profile.id },
      legislators,
    );
    const flags = signalFlags({ ...profile, name: profile.name ?? "" });
    const reasons: string[] = [];
    if (matches.length > 0) reasons.push(`register-match (${matches[0]!.matchedOn})`);
    if (profile.verified_type === "government") reasons.push("government-verified");
    if (flags.some((flag) => flag.startsWith("role-phrase"))) {
      reasons.push(flags.find((flag) => flag.startsWith("role-phrase"))!);
    }
    if (followers >= followerFloor) reasons.push(`followers >= ${followerFloor.toLocaleString()}`);
    return { profile, followers, matches, reasons };
  });

  const toRead = rows.filter((row) => row.reasons.length > 0);
  toRead.sort((a, b) => b.followers - a.followers);

  // Each criterion's own yield, so a criterion that never fires can be retired
  // on evidence rather than kept because it sounds prudent.
  const byCriterion = {
    "register match": rows.filter((row) => row.matches.length > 0).length,
    "government verified_type": rows.filter((r) => r.profile.verified_type === "government").length,
    "role phrase": rows.filter((r) => r.reasons.some((x) => x.startsWith("role-phrase"))).length,
    [`followers >= ${followerFloor.toLocaleString()}`]: rows.filter((r) => r.followers >= followerFloor).length,
  };
  console.log("criterion yield (accounts not already recorded):");
  for (const [name, count] of Object.entries(byCriterion)) {
    console.log(`  ${String(count).padStart(4)}  ${name}`);
  }

  console.log(`\n${toRead.length} of ${rows.length} accounts meet at least one criterion.\n`);
  for (const { profile, followers, matches, reasons } of showEverything ? rows : toRead) {
    console.log(
      `@${profile.username}  "${profile.name}"  ${followers.toLocaleString()} followers` +
        `  vt=${profile.verified_type ?? "absent"}  [${profile.source}]`,
    );
    console.log(`   ${reasons.join(" · ")}`);
    for (const { legislator, matchedOn } of matches.slice(0, 3)) {
      console.log(
        `   register: ${legislator.fullName} (${legislator.chamber}-${legislator.state}, ` +
          `${legislator.era}) via ${matchedOn}`,
      );
    }
    const bio = (profile.description ?? "").replace(/\s+/g, " ").trim();
    if (bio) console.log(`   bio: ${bio.slice(0, 150)}`);
    console.log();
  }

  /*
   * Consolidating the store is this script's one write, and it is deliberate.
   * The profiles are scattered across research files in three different shapes;
   * gathering them into one id-keyed file is what lets `sweep:quotes` know a
   * reading is already paid for before it spends $0.010 buying it again.
   * Derived entirely from files already on disk, so it is idempotent and loses
   * nothing — never a source of truth, only an index of one.
   */
  // `source` is this script's own annotation, not part of the paid reading, so
  // it is dropped before the store is written.
  const store = [...profiles.values()]
    .map((profile): PaidProfile => {
      const copy: SourcedProfile = { ...profile };
      delete (copy as Partial<SourcedProfile>).source;
      return copy;
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  writeFileSync(PROFILE_STORE, JSON.stringify(store, null, 2));
  console.log(
    `profile store written: ${store.length} profiles ` +
      `($${(store.length * 0.01).toFixed(2)} of user reads that will never be bought again)\n`,
  );

  console.log(
    "A register match is a reason to look, not a verification — names collide, and the\n" +
      "historical register holds twelve thousand people. Confirm identity from independent\n" +
      "sources before writing anything (docs/PROVIDERS.md). Nothing was written to data/.",
  );
}

main();
