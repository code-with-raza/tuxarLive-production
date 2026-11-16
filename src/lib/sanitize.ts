import sanitizeHtml from "sanitize-html";

/** Apply the same allowlist to stored HTML, rendered Markdown, and editor paste. */
export function sanitizeRichHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, "img", "figure", "figcaption", "font", "u", "s", "strike"],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "loading", "decoding"],
      "*": ["id", "class", "style"],
      font: ["color", "face", "size"],
    },
    allowedSchemes: ["https", "http", "mailto", "tel"],
    allowedSchemesByTag: { img: ["https", "http"] },
    allowProtocolRelative: false,
    allowedStyles: {
      "*": {
        color: [/^#[0-9a-f]{3,8}$/i, /^[a-z]+$/i, /^rgb\([\d\s,]+\)$/],
        "background-color": [/^#[0-9a-f]{3,8}$/i, /^[a-z]+$/i, /^rgb\([\d\s,]+\)$/],
        "font-weight": [/^(normal|bold|[1-9]00)$/],
        "font-style": [/^(normal|italic)$/],
        "text-decoration": [/^(none|underline|line-through)( (underline|line-through))?$/],
        "margin-left": [/^\d{1,3}(px|pt)$/],
        "text-align": [/^(left|right|center|justify)$/],
        "font-size": [/^\d{1,2}(px|pt)$/],
        "font-family": [/^[a-z\s,'"-]+$/i],
      },
    },
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, rel: "noopener noreferrer", ...(attribs.target === "_blank" ? { target: "_blank" } : { target: "_self" }) },
      }),
    },
  });
}
