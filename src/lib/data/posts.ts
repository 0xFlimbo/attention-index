import postsJson from "@data/posts.json";
import { postsFileSchema, type Post } from "@/schemas/post.schema";
import { isVerifiedRecord } from "./eligibility";

// The only place `data/posts.json` is imported. Parsed once at module load so an
// invalid file fails loudly at build/dev time rather than surfacing as a UI bug.
const posts: Post[] = postsFileSchema.parse(postsJson);

export function getPosts(): Post[] {
  return posts;
}

export function getVerifiedPosts(): Post[] {
  return posts.filter(isVerifiedRecord);
}
