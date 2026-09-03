import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "dist");
const files = [
  ".nojekyll",
  "index.html",
  "manifest.webmanifest",
  "icon.svg",
  "sw.js",
  "styles.css",
  "review-fixes.css",
  "politics.css",
  "election-history.css",
  "ui-v2.css",
  "ui-home-v4.css",
  "ui-home-v5.css",
  "bulletin-reader.css",
  "civic-actions.css",
  "civic-portal.css",
  "app.js",
  "app-runtime.js",
  "politics.js",
  "election-history.js",
  "ui-v2.js",
  "ui-home-v4.js",
  "bulletin-reader.js",
  "civic-actions.js",
  "civic-portal.js"
];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await Promise.all(files.map((file) => cp(resolve(root, file), resolve(output, file))));
await Promise.all(["assets", "data"].map((directory) => cp(resolve(root, directory), resolve(output, directory), { recursive: true })));

console.log(`Built static site in ${output}`);
