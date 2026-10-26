// llms.txt has one source, the repository root. The public copies served by the
// Launchpad and the admin are generated from it: `npm run llms:sync`, or
// `npm run llms:check` to fail when a copy has drifted.
import { readFileSync, writeFileSync } from "node:fs";

const source = readFileSync(new URL("../llms.txt", import.meta.url), "utf8");
const copies = [
  "../apps/platform/public/llms.txt",
  "../apps/admin/public/llms.txt",
];
const check = process.argv.includes("--check");
let drift = false;

for (const copy of copies) {
  const url = new URL(copy, import.meta.url);
  if (check) {
    if (readFileSync(url, "utf8") !== source) {
      console.error(`${copy} differs from llms.txt; run npm run llms:sync`);
      drift = true;
    }
  } else {
    writeFileSync(url, source);
  }
}
if (/\]\((?!https:\/\/)/.test(source)) {
  console.error(
    "llms.txt has a relative link; public copies need absolute URLs"
  );
  drift = true;
}
process.exit(drift ? 1 : 0);
