import milestonesJson from "@data/milestones.json";
import { milestonesFileSchema, type Milestone } from "@/schemas/milestone.schema";
import { isVerifiedRecord } from "./eligibility";

// The only place `data/milestones.json` is imported.
const milestones: Milestone[] = milestonesFileSchema.parse(milestonesJson);

export function getMilestones(): Milestone[] {
  return milestones;
}

export function getVerifiedMilestones(): Milestone[] {
  return milestones.filter(isVerifiedRecord);
}
