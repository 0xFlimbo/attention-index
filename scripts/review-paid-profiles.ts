/**
 * pnpm review:profiles [-- --floor N] [-- --all]
 *
 * Re-reads every profile this project has already paid for and reports the ones
 * a human should look at. **Makes no network request of any kind** — it is the
 * "the data is bought, the reading is free" pass.
 *
 * An account is put in front of a human only when three things hold: a criterion
 * fires, the paid posts show it acting on the project (docs/DATA.md §6 — no act,
 * no record), and it is neither recorded nor already decided in the local
 * register `research/amplifier-decisions.json`. Held accounts are listed apart,
 * with the source that would reopen them.
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
import { postsFileSchema } from "../src/schemas/post.schema";
import { knownAccountKeys, signalFlags } from "../src/lib/sweep/quote-candidates";
import { collectUserObjects, mergeProfiles, type PaidProfile } from "../src/lib/sweep/profile-store";
import {
  actEvidenceUrl,
  actsByAuthor,
  collectPostObjects,
  isProjectSearchFile,
  projectPostIds,
  projectSearchMatchIds,
  selfAuthorIds,
  type PaidPost,
  type ProjectAct,
} from "../src/lib/sweep/amplifier-acts";
import {
  amplifierDecisionsFileSchema,
  findDecision,
  isDueForRecheck,
  type AmplifierDecision,
} from "../src/lib/sweep/amplifier-decisions";
import {
  buildLegislatorIndex,
  matchLegislators,
  type Legislator,
} from "../src/lib/sweep/legislator-index";

const ROOT = process.cwd();
const RESEARCH_DIR = resolve(ROOT, "research");
/** Shared with `sweep:quotes` — the one index of every profile already paid for. */
const PROFILE_STORE = resolve(RESEARCH_DIR, "x-api-profiles.json");
/** Local, maintained by hand: accounts screened and not recorded. */
const DECISIONS = resolve(RESEARCH_DIR, "amplifier-decisions.json");

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

/**
 * Every user object and every post in every research file, each deduplicated
 * by id. One walk, because both come out of the same paid responses.
 */
function loadPaidData(): {
  profiles: Map<string, SourcedProfile>;
  posts: PaidPost[];
  searchMatchIds: Set<string>;
} {
  const profiles = new Map<string, SourcedProfile>();
  const posts: PaidPost[] = [];
  const searchMatchIds = new Set<string>();
  if (!existsSync(RESEARCH_DIR)) return { profiles, posts, searchMatchIds };

  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) return walk(path);
      return entry.isFile() && entry.name.endsWith(".json") ? [path] : [];
    });

  for (const file of walk(RESEARCH_DIR)) {
    if (file === DECISIONS) continue; // the register is maintained by hand, not paid data
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(file, "utf-8"));
    } catch {
      continue; // a malformed research file is not this script's problem to fix
    }
    const label = file.slice(RESEARCH_DIR.length + 1).split("\\").join("/");
    const sourced = collectUserObjects(parsed).map((profile) => ({ ...profile, source: label }));
    mergeProfiles(profiles as Map<string, PaidProfile>, sourced);
    posts.push(...collectPostObjects(parsed));
    if (isProjectSearchFile(label, parsed)) {
      for (const id of projectSearchMatchIds(parsed)) searchMatchIds.add(id);
    }
  }
  return { profiles, posts, searchMatchIds };
}

function loadDecisions(): AmplifierDecision[] {
  if (!existsSync(DECISIONS)) {
    console.log("No decisions register at research/amplifier-decisions.json — nothing is excluded.\n");
    return [];
  }
  const parsed = amplifierDecisionsFileSchema.safeParse(JSON.parse(readFileSync(DECISIONS, "utf-8")));
  if (!parsed.success) {
    console.error("research/amplifier-decisions.json is invalid:\n" + parsed.error.message);
    process.exit(1);
  }
  return parsed.data;
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

type Row = {
  profile: SourcedProfile;
  followers: number;
  matches: ReturnType<typeof matchLegislators>;
  reasons: string[];
  acts: ProjectAct[];
  decision: AmplifierDecision | undefined;
};

function printRow({ profile, followers, matches, reasons, acts, decision }: Row): void {
  console.log(
    `@${profile.username}  "${profile.name}"  ${followers.toLocaleString()} followers` +
      `  vt=${profile.verified_type ?? "absent"}  [${profile.source}]`,
  );
  if (reasons.length > 0) console.log(`   ${reasons.join(" · ")}`);
  for (const { legislator, matchedOn } of matches.slice(0, 3)) {
    console.log(
      `   register: ${legislator.fullName} (${legislator.chamber}-${legislator.state}, ` +
        `${legislator.era}) via ${matchedOn}`,
    );
  }
  const bio = (profile.description ?? "").replace(/\s+/g, " ").trim();
  if (bio) console.log(`   bio: ${bio.slice(0, 150)}`);
  for (const act of acts) {
    const target = act.targetId ? ` of ${act.targetId}` : "";
    console.log(
      `   act: ${act.kind}${target}  ${act.date ?? "undated"}  ${actEvidenceUrl(profile.username, act.postId)}`,
    );
  }
  if (decision) {
    console.log(`   ${decision.verdict} ${decision.decided_at}: ${decision.reason}`);
    if (decision.reopen_if) console.log(`   reopen if: ${decision.reopen_if}`);
    if (decision.recheck_at_followers !== undefined) {
      console.log(`   recheck at: ${decision.recheck_at_followers.toLocaleString()} followers`);
    }
  }
  console.log();
}

function main(): void {
  const { profiles, posts, searchMatchIds } = loadPaidData();
  const legislators = loadLegislators();
  const decisions = loadDecisions();
  const amplifications = amplificationsFileSchema.parse(
    JSON.parse(readFileSync(resolve(ROOT, "data", "amplifications.json"), "utf-8")),
  );
  const trackedPosts = postsFileSchema.parse(
    JSON.parse(readFileSync(resolve(ROOT, "data", "posts.json"), "utf-8")),
  );
  const known = knownAccountKeys(amplifications);

  const selfIds = selfAuthorIds(profiles.values());
  const trackedStatusIds = trackedPosts.flatMap((post) => post.url.match(/status\/(\d+)/)?.[1] ?? []);
  const acts = actsByAuthor(
    posts,
    projectPostIds(trackedStatusIds, posts, selfIds),
    selfIds,
    searchMatchIds,
  );

  console.log(
    `${profiles.size} distinct profiles already paid for · ` +
      `${new Set(posts.map((post) => post.id)).size} paid posts, ` +
      `${[...acts.values()].flat().length} of them acts on the project · ` +
      `${legislators.length} legislators in the register · ` +
      `${known.size} accounts already known · ${decisions.length} decisions on file\n`,
  );

  const reviewed = [...profiles.values()].filter(
    (profile) => !known.has(`@${profile.username.toLowerCase()}`),
  );

  const rows = reviewed.map((profile): Row => {
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
    return {
      profile,
      followers,
      matches,
      reasons,
      acts: acts.get(profile.id) ?? [],
      decision: findDecision(decisions, profile),
    };
  });
  rows.sort((a, b) => b.followers - a.followers);

  const flagged = rows.filter((row) => row.reasons.length > 0);
  const held = flagged.filter((row) => row.decision?.verdict === "held");
  // Turned down for size, and a later paid reading has reached the line: the
  // decision no longer holds on its own terms, so it goes back to a human.
  const recheck = rows.filter((row) => isDueForRecheck(row.decision, row.followers));
  const decided = flagged.filter(
    (row) => row.decision && row.decision.verdict !== "held" && !recheck.includes(row),
  );
  const undecided = flagged.filter((row) => !row.decision);
  const toRead = undecided.filter((row) => row.acts.length > 0);
  const noAct = undecided.filter((row) => row.acts.length === 0);

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

  console.log(
    `\n${flagged.length} of ${rows.length} accounts meet at least one criterion: ` +
      `${toRead.length} to read · ${recheck.length} to recheck · ${held.length} held · ` +
      `${decided.length} decided · ` +
      `${noAct.length} with no act in paid data.\n`,
  );

  console.log(`=== TO READ — a criterion, an act, not recorded, not decided (${toRead.length}) ===\n`);
  toRead.forEach(printRow);

  console.log(`=== RECHECK — turned down for size, now at the line (${recheck.length}) ===\n`);
  recheck.forEach(printRow);

  console.log(`=== HELD — waiting on a source (${held.length}) ===\n`);
  held.forEach(printRow);

  // An act is required before anything can be recorded (docs/DATA.md §6), so
  // these are counted by default. "No act in paid data" is not "no act": the
  // account may have acted in a post nobody paid to read.
  console.log(`=== NO ACT IN PAID DATA (${noAct.length}) — listed with --all ===\n`);
  console.log(`=== DECIDED — out or noted (${decided.length}) — listed with --all ===\n`);
  if (showEverything) {
    console.log("--- no act in paid data ---\n");
    noAct.forEach(printRow);
    console.log("--- decided ---\n");
    decided.forEach(printRow);
    console.log("--- meeting no criterion ---\n");
    rows.filter((row) => row.reasons.length === 0).forEach(printRow);
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
