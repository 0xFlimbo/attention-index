import amplificationsJson from "@data/amplifications.json";
import { amplificationsFileSchema, type Amplification } from "@/schemas/amplification.schema";
import { isVerifiedRecord } from "./eligibility";

// The only place `data/amplifications.json` is imported.
const amplifications: Amplification[] = amplificationsFileSchema.parse(amplificationsJson);

export function getAmplifications(): Amplification[] {
  return amplifications;
}

export function getVerifiedAmplifications(): Amplification[] {
  return amplifications.filter(isVerifiedRecord);
}
