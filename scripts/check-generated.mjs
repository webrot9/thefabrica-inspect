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
//
// Read the frontmatter, not the prose. The page states its provenance in a
// sentence for the reader AND in two fields for a check, and a check that
// parsed the sentence would break the next time the sentence improved.
const commits = new Map();
const versions = new Map();

function frontmatter(text) {
  if (!text.startsWith("---\n")) return null;
  const end = text.indexOf("\n---\n", 4);
  if (end === -1) return null;
  const fields = {};
  for (const line of text.slice(4, end).split("\n")) {
    const at = line.indexOf(":");
    if (at === -1) continue;
    fields[line.slice(0, at).trim()] = line.slice(at + 1).trim().replace(/^"|"$/g, "");
  }
  return fields;
}

for (const file of pages) {
  const text = readFileSync(file, "utf8");
  if (!text.includes("GENERATED FILE — DO NOT EDIT")) {
    fail.push(`${file}: no generated-file banner.`);
  }
  if (!text.includes("**Provenance.**")) {
    fail.push(`${file}: no provenance footer.`);
  }
  const meta = frontmatter(text);
  const sha = meta?.fabrica_documentation_source;
  if (!sha || !/^[0-9a-f]{40}$/.test(sha)) {
    fail.push(`${file}: no fabrica_documentation_source in its frontmatter.`);
    continue;
  }
  if (!commits.has(sha)) commits.set(sha, []);
  commits.get(sha).push(file);

  const version = meta.fabrica_product_version ?? "(none claimed)";
  if (!versions.has(version)) versions.set(version, []);
  versions.get(version).push(file);
}

if (commits.size > 1) {
  fail.push(
    `content/ mixes ${commits.size} exports: ` +
      [...commits].map(([sha, f]) => `${sha.slice(0, 12)} (${f.length} pages)`).join(", ") +
      ". Re-export the whole tree from one ref.",
  );
}
if (versions.size > 1) {
  fail.push(
    `content/ claims ${versions.size} different product versions: ` +
      [...versions].map(([v, f]) => `${v} (${f.length} pages)`).join(", ") +
      ". Every page in one export describes one release.",
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
const [sha] = [...commits.keys()];
const [version] = [...versions.keys()];
console.log(
  `check-generated: ${pages.length} generated pages, all from ${sha.slice(0, 12)} ` +
    `and all describing ${version}; ${handWritten.length} hand-written; ` +
    `every page reachable.`,
);
