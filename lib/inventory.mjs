// The one list of what this site publishes.
//
// Four things need to agree about which pages exist and what they are
// called: the sitemap, llms.txt, the Markdown mirror, and the IndexNow
// submission. A second hand-maintained list is how a retired page keeps
// being advertised — `/operating/cost` was removed from the corpus in
// exactly one place and had to disappear everywhere, and would not have
// if any of those four kept its own copy.
//
// So all four read this, and this reads `content/` and the sidebar files
// that are already generated alongside the pages. Nothing here is
// authored: a page appears because it is in the tree, and it is titled
// and ordered by the `_meta.js` that already had to list it.
//
// This module runs in Node, never in the bundle. It imports `_meta.js` by
// computed path, which webpack cannot follow — a route that imported this
// directly built with a "critical dependency" warning and then failed at
// prerender with MODULE_NOT_FOUND. So `scripts/build-public-assets.mjs`
// runs it once before `next build` and writes `lib/pages.json`; the
// sitemap and the page component import that.

import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

import { SITE_URL } from "./site.mjs";

export { SITE_URL };

const ROOT = "content";

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

/**
 * A YAML double-quoted scalar, as the exporter writes them.
 *
 * It emits JSON-style escapes inside the quotes — `\u2014` for an em dash —
 * which is valid YAML double-quoted style and which the site's own
 * frontmatter parser resolves before rendering. So this has to resolve
 * them too, or llms.txt would advertise a page whose description reads
 * "a public component matrix \u2014 and what none of them check".
 */
function unquote(value) {
  const trimmed = value.trim();
  if (!trimmed.startsWith('"') || !trimmed.endsWith('"')) return trimmed;
  try {
    return JSON.parse(trimmed);
  } catch {
    // A scalar this parser cannot read is a scalar it should not guess at.
    return trimmed.slice(1, -1);
  }
}

/**
 * The frontmatter fields, flat.
 *
 * Deliberately a small parser rather than a YAML dependency, like
 * `check-generated.mjs`: the frontmatter here is written by one generator
 * and is four quoted scalars, and a parser that accepts more than the
 * generator emits is a parser nobody can predict.
 */
function frontmatter(text) {
  if (!text.startsWith("---\n")) return {};
  const end = text.indexOf("\n---\n", 4);
  if (end === -1) return {};
  const fields = {};
  for (const line of text.slice(4, end).split("\n")) {
    const at = line.indexOf(":");
    if (at === -1) continue;
    fields[line.slice(0, at).trim()] = unquote(line.slice(at + 1));
  }
  return fields;
}

/** The page body: no frontmatter, no generator banner, nothing else removed. */
export function body(text) {
  let out = text;
  if (out.startsWith("---\n")) {
    const end = out.indexOf("\n---\n", 4);
    if (end !== -1) out = out.slice(end + 5);
  }
  // The "GENERATED FILE — DO NOT EDIT" banner addresses whoever opens the
  // file in this repository. A reader fetching the Markdown is not that
  // person, and the provenance they do need is in the page's own first
  // paragraph, which stays. Trimmed first: the banner sits after the
  // frontmatter, so it is not at position zero until the leading newlines
  // are gone.
  out = out.trim().replace(/^<!--[\s\S]*?-->\s*/, "");
  return `${out.trim()}\n`;
}

async function meta(dir) {
  const file = join(ROOT, dir, "_meta.js");
  return (await import(pathToFileURL(join(process.cwd(), file)))).default;
}

/**
 * Every page this site serves, in sidebar order, grouped by section.
 *
 * Returns sections `{ id, title, pages: [{ route, url, markdownUrl, title,
 * description, file }] }`. The front page is its own first section with an
 * empty id, because it has no folder and belongs above the rest.
 *
 * `route` is the canonical path: `/` for the front page, `/<path>`
 * otherwise. The optional catch-all also answers `/index`, which is why
 * every page carries a canonical link — see `app/[[...mdxPath]]/page.jsx`.
 */
export async function inventory() {
  const files = walk(ROOT)
    .filter((f) => /\.mdx?$/.test(f))
    .sort();
  const byRoute = new Map(
    files.map((f) => [relative(ROOT, f).replace(/\.mdx?$/, ""), f]),
  );

  const top = await meta("");
  const sections = [];

  for (const [id, title] of Object.entries(top)) {
    // A top-level entry is either a page (`architecture`) or a folder
    // (`production`). Which one it is, is answered by the tree.
    if (byRoute.has(id)) {
      const page = read(id, byRoute.get(id));
      const first = sections.find((s) => s.id === "");
      if (first) first.pages.push(page);
      else sections.push({ id: "", title: "Start here", pages: [page] });
      continue;
    }
    const entries = await meta(id);
    const pages = Object.keys(entries).map((name) => {
      const route = `${id}/${name}`;
      const file = byRoute.get(route);
      if (!file) throw new Error(`inventory: ${route} is listed but absent`);
      return read(route, file, entries[name]);
    });
    sections.push({ id, title, pages });
  }

  return sections;

  function read(route, file, listedAs) {
    const text = readFileSync(file, "utf8");
    const fm = frontmatter(text);
    const canonical = route === "index" ? "/" : `/${route}`;
    return {
      route,
      file,
      // `<route>.md`, and `/index.md` for the front page: `/.md` is not a
      // path, and the front page's own route id is already `index`.
      markdownUrl: `/${route}.md`,
      url: canonical,
      title: fm.title || listedAs || route,
      description: fm.description ?? "",
    };
  }
}

/** Every canonical page URL, absolute, in sidebar order. */
export async function canonicalUrls() {
  const sections = await inventory();
  return sections.flatMap((s) => s.pages.map((p) => `${SITE_URL}${p.url}`));
}
