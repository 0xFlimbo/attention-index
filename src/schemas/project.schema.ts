import { z } from "zod";
import { absoluteUrlString } from "./shared";

/**
 * docs/DATA.md §9 — project metadata only. Never a metric: labels, links,
 * methodology version, disclaimer. No last-update date here — that used to
 * be a hand-typed field and is now derived from the dataset itself
 * (`src/lib/metrics/last-updated.ts`, docs/DATA.md §10).
 */
export const projectSchema = z.object({
  project_name: z.string().min(1),
  short_name: z.string().min(1),
  official_project_url: absoluteUrlString,
  official_x_account: z.string().regex(/^@/, 'must start with "@"'),
  repository_url: absoluteUrlString.nullable(),
  methodology_version: z.string().min(1),
  disclaimer: z.string().min(1),
});

export type Project = z.infer<typeof projectSchema>;
