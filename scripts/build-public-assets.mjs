// Build the three things the rest of the site needs and cannot work out
// for itself: a Markdown mirror of every page, llms.txt, and the page
// inventory as plain data.
//
// All three are derived from `lib/inventory.mjs` and written before
// `next build` runs. None of them is committed: a generated file that
// lives in the tree is a file that can be edited and then disagree with
// the thing it was generated from, and this repository already carries one
// large generated corpus that has to be trusted. Regenerating takes a
// fraction of a second and every build does it.
//
// `lib/pages.json` is the third output and the reason this runs before
// `next build` rather than after it. `lib/inventory.mjs` imports the
// generated `_meta.js` files by computed path, which webpack cannot
// follow: a route importing it directly builds with a critical-dependency
// warning and then fails at prerender. Reading the tree once here and
// handing the routes on as data keeps the filesystem out of the bundle.
//
// Nothing here reaches outside `content/`. The Markdown mirror is the
// page's own body with the frontmatter and the "DO NOT EDIT" banner
// removed — the same words the HTML renders, minus the chrome around them.

import { mkdirSync, writeFileSync } from "node:fs";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { SITE_URL, body, inventory } from "../lib/inventory.mjs";

const OUT = "public";
const PAGES = "lib/pages.json";

/**
 * The pages that answer the four questions somebody arrives with.
 *
 * The only curated list in this file, and the reason llms.txt exists at
 * all: an agent reading top-down should reach "what is this", "what does
 * it assume", "how does the money work" and "what can I replace" before
 * it reaches the health endpoints. Everything below is the sidebar in
 * sidebar order.
 *
 * Route ids, checked against the inventory below — if a page named here
 * is withdrawn from the corpus, the build fails rather than the file
 * quietly advertising a 404.
 */
const START_HERE = [
  "index",
  "architecture",
  "extending/opinionated-and-replaceable",
  "production/credits",
  "production/ownership-and-access",
];

const LEAD = `The Fabrica is a production FastAPI + Next.js SaaS foundation, licensed
once: authentication, billing, credits, background work, account lifecycle
and the compliance surface are already built and tested, and the buyer
extends them for their own product.

This site is the engineering reasoning behind it — what was built, what was
rejected, and where the guarantees are narrower than the convenient
phrasing. Every page under a section heading is extracted from the
product's own documentation rather than written for this site, and names
the product version it describes. It is not the product source, and it is
not open source: the repository it is published from reserves all rights.`;

function link(page) {
  const suffix = page.description ? `: ${page.description}` : "";
  return `- [${page.title}](${SITE_URL}${page.markdownUrl})${suffix}`;
}

async function main() {
  const sections = await inventory();
  const pages = sections.flatMap((s) => s.pages);
  const byRoute = new Map(pages.map((p) => [p.route, p]));

  // --- the Markdown mirror ------------------------------------------------
  for (const page of pages) {
    const target = join(OUT, `${page.route}.md`);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, body(readFileSync(page.file, "utf8")));
  }

  // --- llms.txt -----------------------------------------------------------
  const lines = [`# The Fabrica`, ``];
  lines.push(
    `> Engineering documentation for The Fabrica: a production FastAPI +`,
    `> Next.js SaaS foundation. The decisions, the trade-offs, and the`,
    `> receipts — published so it can be evaluated before it is bought.`,
    ``,
    LEAD,
    ``,
  );

  lines.push(`## Start here`, ``);
  for (const route of START_HERE) {
    const page = byRoute.get(route);
    if (!page) throw new Error(`llms.txt: "${route}" is no longer a page`);
    lines.push(link(page));
  }
  lines.push(``);

  for (const section of sections) {
    // The root section is the front page plus the two standalone pages.
    // Each of those is its own heading, so `architecture` and `releases`
    // are findable by name rather than buried under a catch-all.
    const groups =
      section.id === ""
        ? section.pages
            .filter((p) => p.route !== "index")
            .map((p) => ({ title: p.title, pages: [p] }))
        : [section];
    for (const group of groups) {
      lines.push(`## ${group.title}`, ``);
      for (const page of group.pages) lines.push(link(page));
      lines.push(``);
    }
  }

  writeFileSync(join(OUT, "llms.txt"), `${lines.join("\n").trimEnd()}\n`);

  // --- the inventory, as data the bundle can import -----------------------
  writeFileSync(
    PAGES,
    `${JSON.stringify(
      pages.map(({ route, url, markdownUrl, title }) => ({
        route,
        url,
        markdownUrl,
        title,
      })),
      null,
      2,
    )}\n`,
  );

  console.log(
    `build-public-assets: ${pages.length} Markdown pages, llms.txt ` +
      `(${sections.length} sidebar sections) and ${PAGES} written.`,
  );
}

await main();
