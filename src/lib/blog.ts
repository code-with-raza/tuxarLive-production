/**
 * Thin re-export shim.
 * `src/lib/blog.ts` is resolved by TypeScript before `src/lib/blog/index.ts`
 * so this file MUST re-export everything from the real barrel.
 */
export * from "./blog/index";

// Backward-compat alias — consumers using `Post` instead of `BlogPost`
export type { BlogPost as Post } from "./blog/index";
