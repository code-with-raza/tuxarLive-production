import { Marked, type Renderer } from "marked";
import { sanitizeRichHtml } from "../sanitize";
import { calculateReadMinutes } from "./reading-time";

/** Escape HTML entities in plain text */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Creates an isolated marked instance per call so concurrent SSR requests
 * never share renderer state.
 */
export function createMarkdownParser() {
  const instance = new Marked();
  const usedIds = new Map<string, number>();

  const resolveId = (text: string): string => {
    const base = slugifyHeading(text) || "section";
    const count = usedIds.get(base) ?? 0;
    usedIds.set(base, count + 1);
    return count === 0 ? base : `${base}-${count + 1}`;
  };

  const renderer: Partial<Renderer> = {
    heading({ tokens, depth }) {
      const text = this.parser!.parseInline(tokens);
      const plain = text.replace(/<[^>]+>/g, "");
      const id = resolveId(plain);
      return `<h${depth} id="${id}">${text}</h${depth}>\n`;
    },
    code({ text, lang }) {
      const language = lang ? escapeHtml(lang) : "";
      const langClass = language ? ` class="language-${language}"` : "";
      const escaped = escapeHtml(text);
      return `<pre class="blog-code-block"><code${langClass}>${escaped}</code></pre>\n`;
    },
    image({ href, title, text }) {
      const alt = escapeHtml(text || title || "");
      const src = escapeHtml(href);
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
      return `<figure class="blog-figure"><img src="${src}" alt="${alt}" loading="lazy" decoding="async"${titleAttr} /><figcaption class="sr-only">${alt}</figcaption></figure>\n`;
    },
    link({ href, title, tokens }) {
      const inner = this.parser!.parseInline(tokens);
      const safeHref = escapeHtml(href);
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
      const isExternal = /^https?:\/\//.test(href);
      const rel = isExternal ? ' rel="noopener noreferrer"' : "";
      const target = isExternal ? ' target="_blank"' : "";
      return `<a href="${safeHref}"${titleAttr}${rel}${target}>${inner}</a>`;
    },
  };

  instance.use({ renderer, gfm: true, breaks: false });
  return instance;
}

/** Shared parser for single-threaded Node server functions */
const sharedParser = createMarkdownParser();

/**
 * Parse raw Markdown to HTML on the server.
 * Detects already-parsed HTML gracefully (starts with "<").
 */
export function markdownToHtml(raw: string): string {
  if (!raw) return "";
  const content = raw.trim();
  if (content.startsWith("<")) return sanitizeRichHtml(content);
  return sanitizeRichHtml(sharedParser.parse(content) as string);
}

export function extractTocFromHtml(html: string): { id: string; text: string; level: 2 | 3 }[] {
  const items: { id: string; text: string; level: 2 | 3 }[] = [];
  const regex = /<h([23]) id="([^"]+)">([\s\S]*?)<\/h[23]>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const level = Number(match[1]) as 2 | 3;
    const id = match[2];
    const text = match[3].replace(/<[^>]+>/g, "").trim();
    if (text && !/^table of contents$/i.test(text)) {
      items.push({ id, text, level });
    }
  }
  return items;
}

export { calculateReadMinutes };
