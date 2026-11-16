import fs from 'node:fs/promises';
import { begin, end } from '../../scripts/wordpress-retirement-policy.mjs';
export const hosting = await fs.readFile('public/.htaccess', 'utf8');
export const block = hosting.slice(hosting.indexOf(begin), hosting.indexOf(end));
export const rules = [];
let conditions = [];
for (const line of ['RewriteRule ^wp-admin(?:/|$) - [F,L,NC]', ...block.split(/\r?\n/)]) {
  const condition = line.trim().match(/^RewriteCond %\{QUERY_STRING\} (\S+) \[NC\]$/);
  if (condition) { conditions.push(new RegExp(condition[1], 'i')); continue; }
  const match = line.trim().match(/^RewriteRule (\S+) (\S+) \[([^\]]+)\]$/);
  if (!match) continue;
  const [, pattern, destination, text] = match;
  const flags = text.split(',');
  if (flags.some(flag => ['G', 'F', 'R=301', 'R=410', 'R=404'].includes(flag))) rules.push({ regex: new RegExp(pattern, flags.includes('NC') ? 'i' : ''), conditions, destination, flags });
  conditions = [];
}
// A bounded model of the generated rules, not a native Apache/LiteSpeed engine.
export function evaluate(target) {
  const url = new URL(target, 'https://tuxar.co.uk');
  const rule = rules.find(rule => rule.regex.test(decodeURIComponent(url.pathname).slice(1)) && rule.conditions.every(condition => condition.test(url.search.slice(1))));
  if (!rule) return undefined;
  const status = rule.flags.includes('F') ? 403 : rule.flags.includes('G') || rule.flags.includes('R=410') ? 410 : rule.flags.includes('R=404') ? 404 : 301;
  return { status, location: status === 301 ? rule.destination + (rule.flags.includes('QSD') ? '' : url.search) : undefined, flags: rule.flags };
}
