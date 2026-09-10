// Generated pages must look generated, and must agree with each other.
//
// The export is reproducible, so the real check on whether this tree is
// current is a diff against a fresh run of the exporter — which needs the
// private repository and therefore happens on a maintainer's machine, not
// here. What CI can check without any private dependency is that nothing
// in the tree contradicts itself:
//
//   * every generated page says which commit it came from;
//   * they all say the SAME commit, so the tree is one export rather than
//     a mixture of two;
//   * every sidebar entry resolves to a page, and every page is listed;
//   * no page carries a `public:` marker, which would mean the extraction
//     shipped its own scaffolding.
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = "content";
const fail = [];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const files = walk(ROOT).sort();
const pages = files.filter((f) => f.endsWith(".md"));
const handWritten = files.filter((f) => f.endsWith(".mdx"));
const metas = files.filter((f) => f.endsWith("_meta.js"));

if (pages.length === 0) fail.push("content/ holds no generated page at all.");

// --- one export, not a mixture -------------------------------------------
const commits = new Map();
for (const file of pages) {
  const text = readFileSync(file, "utf8");
  if (!text.includes("GENERATED FILE — DO NOT EDIT")) {
    fail.push(`${file}: no generated-file banner.`);
  }
  const m = text.match(/Extracted from The Fabrica at `[^`]+` \(`([0-9a-f]{12})`\)/);
  if (!m) {
    fail.push(`${file}: does not say which commit it came from.`);
    continue;
  }
  if (!commits.has(m[1])) commits.set(m[1], []);
  commits.get(m[1]).push(file);
}
if (commits.size > 1) {
  fail.push(
    `content/ mixes ${commits.size} exports: ` +
      [...commits].map(([sha, f]) => `${sha} (${f.length} pages)`).join(", ") +
      ". Re-export the whole tree from one ref.",
  );
}

// --- nothing leaked the extraction scaffolding ---------------------------
//
// A marker ON ITS OWN LINE is what the exporter acts on, so one surviving
// into the output means a region boundary went somewhere nobody chose. A
// marker mentioned inside a sentence is a different thing entirely: the
// page about how these documents are maintained has to be able to name the
// convention it is describing.
const MARKERS = ["<!-- public:begin -->", "<!-- public:end -->"];
for (const file of [...pages, ...handWritten]) {
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, i) => {
      if (MARKERS.includes(line.trim())) {
        fail.push(`${file}:${i + 1}: a bare ${line.trim()} survived extraction.`);
      }
    });
}

// --- the sidebar and the tree agree --------------------------------------
const routeOf = (f) => relative(ROOT, f).replace(/\.mdx?$/, "");
const present = new Set([...pages, ...handWritten].map(routeOf));

for (const meta of metas) {
  const dir = relative(ROOT, join(meta, ".."));
  const entries = Object.keys((await import(pathToFileURL(join(process.cwd(), meta)))).default);
  for (const entry of entries) {
    const route = dir ? `${dir}/${entry}` : entry;
    const isSection = metas.includes(join(ROOT, route, "_meta.js"));
    if (!isSection && !present.has(route)) {
      fail.push(`${meta}: lists "${entry}", but ${route} is not a page here.`);
    }
  }
}

for (const route of present) {
  const parts = route.split("/");
  const meta = join(ROOT, ...parts.slice(0, -1), "_meta.js");
  if (!metas.includes(meta)) {
    fail.push(`${route}: no sidebar file lists it — it would be unreachable.`);
    continue;
  }
  const entries = (await import(pathToFileURL(join(process.cwd(), meta)))).default;
  if (!(parts.at(-1) in entries)) {
    fail.push(`${route}: ${meta} does not list it — it would be unreachable.`);
  }
}

if (fail.length) {
  for (const line of fail) console.error(`check-generated: ${line}`);
  process.exit(1);
}
console.log(
  `check-generated: ${pages.length} generated pages, all from ${[...commits.keys()][0]}; ` +
    `${handWritten.length} hand-written; every page reachable.`,
);
