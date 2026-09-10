/**
 * sitemap.xml — the canonical URL of every page, once each.
 *
 * Read from `lib/pages.json`, which `scripts/build-public-assets.mjs`
 * writes from `content/` and the generated sidebar files before every
 * build. A hand-kept list here would have gone on advertising
 * `/operating/cost` after the page was withdrawn from the corpus, which is
 * the whole reason the inventory has one owner.
 *
 * Two things this deliberately omits.
 *
 * `/index`: the optional catch-all answers the front page at both `/` and
 * `/index`. One of them is the canonical URL and the other is a duplicate
 * that already carries a canonical link pointing here; putting both in the
 * sitemap would ask a crawler to index the duplicate as well.
 *
 * `lastModified`: we have no honest source for it. The pages are generated
 * from a private repository and committed here in bulk, so their file
 * mtimes are whenever the deployment checked out the tree and their commit
 * dates are when the export ran, not when the passage changed. Stamping
 * every entry with the build time would be worse than saying nothing: it
 * claims all 32 pages changed on every deploy, which teaches a crawler to
 * ignore the field. Omitted until the export can carry a real per-page
 * date. `changeFrequency` and `priority` are omitted for the same reason —
 * both would be guesses, and Google ignores them regardless.
 */

import { SITE_URL } from "../lib/site.mjs";
import pages from "../lib/pages.json";

export default function sitemap() {
  return pages.map((page) => ({ url: `${SITE_URL}${page.url}` }));
}
