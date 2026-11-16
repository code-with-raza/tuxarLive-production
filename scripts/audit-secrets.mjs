import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { assertPublicEnvironment } from "./public-env.mjs";

// Findings contain locations and classifications only. Never emit matched values.
const textFile = /(?:\.(?:[cm]?[jt]sx?|json|sql|md|txt|toml|ya?ml|html|css|conf|ini|ps1|sh|xml|pem|key)|(?:^|\/)\.env(?:\.[^/]+)?|\.htaccess)$/i;
const patterns = [
  ["Stripe private API key", /\b(?:sk|rk)_(?:live|test)_[a-zA-Z0-9]{16,}/g],
  ["Stripe webhook secret", /\bwhsec_[a-zA-Z0-9]{16,}/g],
  ["Supabase secret key", /\bsb_secret_[a-zA-Z0-9_-]{16,}/g],
  ["Private key", /-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----/g],
  ["GitHub private token", /\bgh[pousr]_[A-Za-z0-9]{30,}/g],
  ["AWS access key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ["Resend credential assignment", /RESEND_API_KEY[\s"']*[:=][\s"']*re_[A-Za-z0-9_]{16,}/g],
  ["Cloudinary secret assignment", /CLOUDINARY_API_SECRET[\s"']*[:=][\s"']*[A-Za-z0-9_-]{20,}/g],
];
const findings = [];
function scan(content, location, scope) {
  for (const [kind, pattern] of patterns) {
    pattern.lastIndex = 0;
    for (const match of content.matchAll(pattern)) findings.push({ scope, location, kind, line: content.slice(0, match.index).split("\n").length });
  }
  for (const match of content.matchAll(/\beyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)) {
    try {
      const payload = JSON.parse(Buffer.from(match[1], "base64url").toString());
      if (payload.role === "service_role") findings.push({ scope, location, kind: "Supabase service-role JWT", line: content.slice(0, match.index).split("\n").length });
    } catch { /* Non-JWT text is not a finding. */ }
  }
}
const trackedAndUntracked = execFileSync("git", ["ls-files", "-c", "-o", "--exclude-standard", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
const working = new Set([...trackedAndUntracked, ...fs.readdirSync(".").filter((name) => /^\.env(?:\.|$)/.test(name) && name !== ".env.example")]);
let workingFiles = 0;
for (const file of working) {
  if (!textFile.test(file) || !fs.existsSync(file)) continue;
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size > 5_000_000) continue;
  scan(fs.readFileSync(file, "utf8"), file, "working tree"); workingFiles += 1;
}
const environment = {};
for (const file of [".env", ".env.local", ".env.production", ".env.production.local"]) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const entry = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (entry) environment[entry[1]] = entry[2].replace(/^['"]|['"]$/g, "");
  }
}
try { assertPublicEnvironment({ ...environment, ...process.env }); }
catch (error) { findings.push({ scope: "environment", location: ".env files / process", kind: error.message }); }

const allObjects = execFileSync("git", ["rev-list", "--objects", "--all", "--reflog"], { encoding: "utf8", maxBuffer: 32_000_000 }).split("\n");
const blobs = new Map();
for (const row of allObjects) {
  const separator = row.indexOf(" ");
  if (separator < 0) continue;
  const file = row.slice(separator + 1);
  if (textFile.test(file)) blobs.set(row.slice(0, separator), file);
}
const ids = [...blobs.keys()];
const batch = execFileSync("git", ["cat-file", "--batch"], { input: ids.join("\n") + "\n", maxBuffer: 128_000_000 });
let offset = 0;
for (const id of ids) {
  const end = batch.indexOf(10, offset);
  const [object, type, size] = batch.subarray(offset, end).toString().split(" ");
  if (type !== "blob" || object !== id) throw new Error("Git object scan could not complete");
  offset = end + 1;
  scan(batch.subarray(offset, offset + Number(size)).toString("utf8"), `${blobs.get(id)} (blob ${id.slice(0, 12)})`, "git history and reflogs");
  offset += Number(size) + 1;
}
let buildFiles = 0;
function scanBuild(folder) {
  if (!fs.existsSync(folder)) return;
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const file = path.join(folder, entry.name);
    if (entry.isDirectory()) scanBuild(file);
    else if (textFile.test(file)) { scan(fs.readFileSync(file, "utf8"), file, "local build"); buildFiles += 1; }
  }
}
scanBuild("dist");
const report = {
  scannedAt: new Date().toISOString(),
  commits: Number(execFileSync("git", ["rev-list", "--count", "--all", "--reflog"], { encoding: "utf8" }).trim()),
  workingFiles, historicalTextBlobs: ids.length, buildFiles,
  environmentVariableNames: Object.keys(environment),
  findings,
  scope: "High-confidence credential patterns in readable project files, environment files, the current dist build, and all reachable Git refs/reflogs. Does not inspect encrypted, compressed, remote, or unreachable deleted objects.",
};
fs.mkdirSync("output/security", { recursive: true });
fs.writeFileSync("output/security/secret-scan.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify({ commits: report.commits, workingFiles, historicalTextBlobs: ids.length, buildFiles, findings }, null, 2));
if (findings.length) process.exitCode = 1;
