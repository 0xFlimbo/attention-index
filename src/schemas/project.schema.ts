import { z } from "zod";
import { absoluteUrlString, isoDateString } from "./shared";

/**
 * docs/DATA.md §9 — project metadata only. Never a metric: labels, links,
 * last-update date, methodology version, disclaimer.
 */
export const projectSchema = z.object({
  project_name: z.string().min(1),
  short_name: z.string().min(1),
  official_project_url: absoluteUrlString,
  official_x_account: z.string().regex(/^@/, 'must start with "@"'),
  repository_url: absoluteUrlString.nullable(),
  data_last_updated: isoDateString,
  methodology_version: z.string().min(1),
  disclaimer: z.string().min(1),
});

export type Project = z.infer<typeof projectSchema>;
