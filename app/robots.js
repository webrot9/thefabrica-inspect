/**
 * robots.txt — everything, to everyone.
 *
 * This site exists to be read before anything is bought, by people and by
 * the models people ask. There is nothing here to hold back: the corpus is
 * published deliberately, page by page, through a two-gate allowlist, and a
 * passage that should not be crawled should not be published rather than
 * published and then asked politely not to be indexed.
 *
 * So one universal rule rather than an allowlist of named crawlers. Naming
 * Googlebot, Bingbot, OAI-SearchBot, ClaudeBot, Claude-SearchBot,
 * Claude-User and ChatGPT-User individually would say exactly what
 * `User-agent: *` already says, and would then be a list that silently
 * fails to mention whatever crawls the web in two years. A named group is
 * worth adding only when it needs a rule different from everyone else's,
 * and none of them does.
 *
 * A `Disallow` here would also be the wrong tool twice over: the pages are
 * public, and robots.txt governs crawling, not access.
 */

import { SITE_URL } from "../lib/site.mjs";

export default function robots() {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
