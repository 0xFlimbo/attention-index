import projectJson from "@data/project.json";
import { projectSchema, type Project } from "@/schemas/project.schema";

// The only place `data/project.json` is imported. Metadata only — never metrics.
const project: Project = projectSchema.parse(projectJson);

export function getProjectMetadata(): Project {
  return project;
}
