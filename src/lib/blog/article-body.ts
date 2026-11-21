/** The page title supplies H1. Pasted copies must not create a second title. */
export function normalizeArticleBody(html: string, title: string): string {
  const text = (value: string) => value.replace(/<[^>]*>/g, "")
    .replace(/&#(?:x([0-9a-f]+)|(\d+));/gi, (entity, hex, decimal) => {
      const code = parseInt(hex || decimal, hex ? 16 : 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
    })
    .replace(/&(amp|quot|apos|nbsp|lt|gt);/g, entity => ({ "&amp;": "&", "&quot;": '"', "&apos;": "'", "&nbsp;": " ", "&lt;": "<", "&gt;": ">" })[entity] || entity)
    .replace(/\s+/g, " ").trim();
  const leading = /^\s*<h1\b[^>]*>([\s\S]*?)<\/h1>\s*/i.exec(html);
  if (leading && text(leading[1]) === text(title)) html = html.slice(leading[0].length);
  return html.replace(/<(\/?)(h1)(?=[\s>])/gi, '<$1h2');
}
