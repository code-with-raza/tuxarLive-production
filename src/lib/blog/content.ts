import { calculateReadMinutes, markdownToHtml } from "./markdown";
import { mapSeoFields } from "./seo";
import type { BlogFrontmatter, BlogPost } from "./types";
import { getProductAsset } from "@/assets";
import { sanitizeRichHtml } from "../sanitize";

// ---------------------------------------------------------------------------
// Browser-safe YAML frontmatter parser
// Replaces gray-matter which uses require('fs') — a Node.js-only module that
// cannot run in the browser bundle.  We only need to handle the small subset
// of YAML that our own Markdown files actually use.
// ---------------------------------------------------------------------------

interface FrontmatterResult {
  data: Partial<BlogFrontmatter>;
  content: string;
}

/**
 * Parse a single "key: value" YAML line into [key, value] or null.
 * Handles:
 *   - Quoted values:   title: "My Title"  or  title: 'My Title'
 *   - Unquoted values: category: Craftsmanship
 *   - Integer values:  readMinutes: 13
 */
function parseYamlLine(line: string): [string, string | number] | null {
  const colonIdx = line.indexOf(":");
  if (colonIdx === -1) return null;

  const key = line.slice(0, colonIdx).trim();
  if (!key) return null;

  const rawVal = line.slice(colonIdx + 1).trim();

  // Quoted string (single or double)
  if (
    (rawVal.startsWith('"') && rawVal.endsWith('"')) ||
    (rawVal.startsWith("'") && rawVal.endsWith("'"))
  ) {
    return [key, rawVal.slice(1, -1)];
  }

  // Integer
  if (/^\d+$/.test(rawVal)) {
    return [key, parseInt(rawVal, 10)];
  }

  // Unquoted — return as-is (works for dates, plain strings, etc.)
  return rawVal ? [key, rawVal] : null;
}

/**
 * Split a raw Markdown string into its frontmatter data object and body.
 * Mirrors the { data, content } shape returned by gray-matter so callers
 * need no changes.
 */
function parseFrontmatter(raw: string): FrontmatterResult {
  const str = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Must start with ---
  if (!str.startsWith("---")) {
    return { data: {}, content: str };
  }

  const closeIdx = str.indexOf("\n---", 3);
  if (closeIdx === -1) {
    return { data: {}, content: str };
  }

  const yamlBlock = str.slice(4, closeIdx); // between opening --- and closing ---
  const body = str.slice(closeIdx + 4).replace(/^\n/, ""); // text after closing ---

  const data: Record<string, string | number> = {};
  for (const line of yamlBlock.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const parsed = parseYamlLine(trimmed);
    if (parsed) {
      const [k, v] = parsed;
      data[k] = v;
    }
  }

  return { data: data as Partial<BlogFrontmatter>, content: body };
}

/**
 * Article pages already render the frontmatter title as their single H1.
 * Remove a leading Markdown H1 so the title is not repeated in the page body.
 */
function removeLeadingTitleHeading(content: string): string {
  return content.replace(/^\s*#\s+[^\n]+\n+/, "");
}

// ---------------------------------------------------------------------------

const markdownFiles = import.meta.glob("/src/content/blog/*.md", {
  eager: true,
  query: "?raw",
  import: "default",
});

function parseMarkdownFile(raw: string, fallbackSlug: string): BlogPost {
  let data: Partial<BlogFrontmatter>;
  let content: string;

  try {
    const parsed = parseFrontmatter(raw);
    data = parsed.data;
    content = removeLeadingTitleHeading(parsed.content);
  } catch (err) {
    // Malformed frontmatter — surface a degraded post rather than crashing
    // the entire Journal.  Log the error so developers can fix the file.
    console.error(`[Journal] Failed to parse frontmatter for "${fallbackSlug}":`, err);
    data = {};
    content = removeLeadingTitleHeading(raw);
  }

  const slug = (data.slug as string | undefined) || fallbackSlug;
  const readMinutes =
    typeof data.readMinutes === "number"
      ? data.readMinutes
      : calculateReadMinutes(content);

  let contentHtml = "";
  try {
    contentHtml = markdownToHtml(content);
  } catch (err) {
    console.error(`[Journal] Failed to render Markdown for "${slug}":`, err);
    contentHtml = sanitizeRichHtml(`<p>${content.slice(0, 300)}</p>`);
  }

  return {
    id: slug,
    slug,
    title: (data.title as string | undefined) || "Untitled",
    excerpt: (data.excerpt as string | undefined) || "",
    contentMarkdown: content,
    contentHtml,
    image: getProductAsset(
      (data.image as string | undefined) || "/blog_images/italian-leather.webp",
    ),
    category: (data.category as string | undefined) || "Atelier",
    readMinutes,
    author: (data.author as string | undefined) || "Tuxar Atelier",
    date: data.date as string | undefined,
    seo: mapSeoFields(data as Record<string, unknown>),
  };
}

/** All posts from markdown files (build-time / sitemap) */
export function getAllPostsFromMarkdown(): BlogPost[] {
  return Object.entries(markdownFiles).map(([path, file]) => {
    const raw = file as string;
    const fallbackSlug = path.split("/").pop()?.replace(".md", "") || "untitled";
    return parseMarkdownFile(raw, fallbackSlug);
  });
}

export function getPostBySlugFromMarkdown(slug: string): BlogPost | undefined {
  return getAllPostsFromMarkdown().find((p) => p.slug === slug);
}

/** Parse a raw markdown string (used by seed script pattern) */
export function parseBlogMarkdown(raw: string, fallbackSlug: string): BlogPost {
  return parseMarkdownFile(raw, fallbackSlug);
}
