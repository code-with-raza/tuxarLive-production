import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

// Local metadata and hashes only: never copy source contents or environment values.
const folder = path.resolve("output/production-security-2026-10-17");
const destination = path.join(folder, "repository-baseline.json");
if (fs.existsSync(destination)) throw new Error("The existing baseline will not be overwritten");
const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 16_000_000 }).trimEnd();
const names = git("ls-files", "-c", "-o", "--exclude-standard", "-z").split("\0").filter(Boolean);
const files = names.filter((name) => !/(^|\/)\.env(?:\.|$)/.test(name) || name === ".env.example").filter((name) => fs.existsSync(name) && fs.statSync(name).isFile()).map((name) => ({ path: name.replaceAll("\\", "/"), sha256: createHash("sha256").update(fs.readFileSync(name)).digest("hex") }));
fs.mkdirSync(folder, { recursive: true });
fs.writeFileSync(destination, JSON.stringify({ capturedAt: new Date().toISOString(), branch: git("branch", "--show-current"), head: git("rev-parse", "HEAD"), status: git("status", "--short"), files, note: "Captured before the review's application edits. Existing modifications were already present. Environment values are excluded." }, null, 2), { flag: "wx" });
console.log(JSON.stringify({ destination, fileCount: files.length }));
