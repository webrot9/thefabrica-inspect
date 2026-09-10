// The one page on this site that is hand-written AND contains real code.
//
// Everything under a generated section is extracted from the private
// repository, so it cannot drift from its source. `receipts/example-resource`
// can: it inlines the six files in `examples/owned-resource/` so they can be
// read in place, and a copy is a thing that goes stale.
//
// This is the guard. It is deliberately dumb — no parser, no AST, no
// tolerance for "equivalent" — because the only useful answer here is
// byte-for-byte.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const PAGE = "content/receipts/example-resource.mdx";
const DIR = "examples/owned-resource";

const page = readFileSync(PAGE, "utf8");
const blocks = new Map();
const fence = /```python filename="([^"]+)"\n([\s\S]*?)\n```/g;
for (const [, name, body] of page.matchAll(fence)) {
  if (blocks.has(name)) {
    console.error(`${PAGE}: \`${name}\` is inlined twice.`);
    process.exit(1);
  }
  blocks.set(name, body);
}

const files = readdirSync(DIR).filter((f) => f.endsWith(".py")).sort();
let failed = false;

for (const name of files) {
  const onDisk = readFileSync(join(DIR, name), "utf8").replace(/\s+$/, "");
  if (!blocks.has(name)) {
    console.error(`${PAGE}: ${DIR}/${name} exists but is not inlined.`);
    failed = true;
    continue;
  }
  if (blocks.get(name) !== onDisk) {
    console.error(
      `${PAGE}: the \`${name}\` block no longer matches ${DIR}/${name}. ` +
        `Re-inline it; do not edit one copy alone.`,
    );
    failed = true;
  }
  blocks.delete(name);
}

for (const name of blocks.keys()) {
  console.error(`${PAGE}: inlines \`${name}\`, which is not in ${DIR}/.`);
  failed = true;
}

if (failed) process.exit(1);
console.log(`check-examples: ${files.length} files match their inlined copies.`);
