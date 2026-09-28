/**
 * The register of accounts already screened and not recorded.
 *
 * `research/amplifier-decisions.json`, local like the rest of `research/`: it
 * names people who were turned down, which is bookkeeping for the maintainer and
 * not something to publish. Without it a turned-down account comes back as new
 * on every review, and the reason it was turned down has to be re-derived — the
 * way one rejection was nearly re-argued from a truncated post.
 *
 * It holds only what `data/` cannot say. An account that went in is a record in
 * `data/amplifications.json` and is never repeated here.
 */
import { z } from "zod";

export const decisionVerdictEnum = z.enum([
  /** Screened and not recorded; `reason` says which rule of docs/DATA.md §6 failed. */
  "out",
  /** Accepted in principle, blocked on a missing source; `reopen_if` names it. */
  "held",
  /** The act belongs to a person already recorded, and sits in that record's notes. */
  "noted",
]);

export const amplifierDecisionSchema = z
  .object({
    account: z.string().regex(/^@\w+$/, "an X handle with its @"),
    /** Survives a handle change, so it is the key when present. */
    x_user_id: z.string().regex(/^\d+$/).optional(),
    verdict: decisionVerdictEnum,
    reason: z.string().min(1),
    decided_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reopen_if: z.string().min(1).optional(),
    /**
     * An identified person turned away only for audience (docs/DATA.md §6: below
     * 100,000, `public_figure` is closed whatever the role). Accounts grow, so the
     * review puts them back in front of a human once a paid reading reaches this.
     */
    recheck_at_followers: z.number().int().positive().optional(),
    /** Where the identity or role was looked for, so the search is not repeated blind. */
    sources_checked: z.array(z.string()).optional(),
  })
  .refine((decision) => decision.verdict !== "held" || decision.reopen_if !== undefined, {
    message: "a held account needs `reopen_if`, or it can never be reopened",
    path: ["reopen_if"],
  })
  .refine(
    (decision) => decision.verdict === "out" || decision.recheck_at_followers === undefined,
    {
      message: "only an `out` for size can be rechecked on followers",
      path: ["recheck_at_followers"],
    },
  );

export const amplifierDecisionsFileSchema = z.array(amplifierDecisionSchema);

export type AmplifierDecision = z.infer<typeof amplifierDecisionSchema>;

/**
 * Whether a decision turned down for size is due for another look. It can only
 * see the latest reading someone paid for: an account that crossed the line
 * since its profile was last read stays silent until a sweep reads it again.
 */
export function isDueForRecheck(
  decision: AmplifierDecision | undefined,
  followers: number,
): boolean {
  return decision?.recheck_at_followers !== undefined && followers >= decision.recheck_at_followers;
}

/** The decision on an account, by id first and handle second. */
export function findDecision(
  decisions: readonly AmplifierDecision[],
  account: { id: string; username: string },
): AmplifierDecision | undefined {
  const handle = `@${account.username.toLowerCase()}`;
  return (
    decisions.find((decision) => decision.x_user_id === account.id) ??
    decisions.find(
      (decision) => decision.x_user_id === undefined && decision.account.toLowerCase() === handle,
    )
  );
}
