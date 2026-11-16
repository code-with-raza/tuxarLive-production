import { WORDS_PER_MINUTE } from "./constants";

/** Strip markdown syntax for a rough word count */
function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]+`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/^#{1,6}\s+/gm, " ")
    .replace(/[*_~>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function countWords(markdown: string): number {
  const text = stripMarkdown(markdown);
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

export function calculateReadMinutes(markdown: string, fallback = 5): number {
  const words = countWords(markdown);
  if (words === 0) return fallback;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}
