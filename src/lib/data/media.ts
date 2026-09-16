import mediaJson from "@data/media.json";
import { mediaFileSchema, type MediaReference } from "@/schemas/media.schema";
import { isVerifiedRecord } from "./eligibility";

// The only place `data/media.json` is imported.
const mediaReferences: MediaReference[] = mediaFileSchema.parse(mediaJson);

export function getMediaReferences(): MediaReference[] {
  return mediaReferences;
}

export function getVerifiedMediaReferences(): MediaReference[] {
  return mediaReferences.filter(isVerifiedRecord);
}
