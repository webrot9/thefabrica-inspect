// Tell IndexNow which pages actually changed. Run by hand, after a deploy.
//
//   node scripts/indexnow.mjs            # show what would be submitted
//   node scripts/indexnow.mjs --submit   # submit, then record what was sent
//
// IndexNow needs no account and no secret. The credential is a key you
// choose and then publish at `https://<host>/<key>.txt`; an engine that
// receives a submission fetches that file and compares. The key in this
// repository is committed for exactly that reason — it is not a secret,
// and treating it as one would mean it could not be served.
//
// What makes this worth running rather than submitting the whole sitemap:
// IndexNow is for change notification. Resubmitting 32 unchanged URLs on
// every deploy is the behaviour the protocol asks you not to have, and it
// gets a host de-prioritised. So the script keeps a record of what it last
// submitted — the URL and a hash of the Markdown that URL renders — and
// sends only what is new, what hashes differently, and what has gone.
//
// A removed URL is submitted too. IndexNow is how you ask an engine to
// recrawl and drop something; a page that quietly disappears from the
// sitemap stays in the index until a crawler happens back.
//
// No cross-repository automation and no CI step: this runs from a
// maintainer's machine after the deployment it describes is actually live,
// because submitting a URL an engine cannot yet fetch is worse than
// submitting nothing. `scripts/indexnow-state.json` is the record and is
// committed with the change it describes.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

import { SITE_URL, body, inventory } from "../lib/inventory.mjs";

const KEY = "8f4d686da42c953659f5e3c18f23d2a6";
const HOST = new URL(SITE_URL).host;
const ENDPOINT = "https://api.indexnow.org/IndexNow";
const STATE = "scripts/indexnow-state.json";

const submit = process.argv.includes("--submit");

/** URL → hash of the words that URL publishes. */
async function current() {
  const sections = await inventory();
  const out = {};
  for (const page of sections.flatMap((s) => s.pages)) {
    const text = body(readFileSync(page.file, "utf8"));
    out[`${SITE_URL}${page.url}`] = createHash("sha256")
      .update(text)
      .digest("hex")
      .slice(0, 16);
  }
  return out;
}

function previous() {
  try {
    return JSON.parse(readFileSync(STATE, "utf8")).urls ?? {};
  } catch {
    // No record yet: the first run submits everything, which is correct.
    return {};
  }
}

const now = await current();
const then = previous();

const added = Object.keys(now).filter((url) => !(url in then));
const changed = Object.keys(now).filter(
  (url) => url in then && then[url] !== now[url],
);
const removed = Object.keys(then).filter((url) => !(url in now));
const urlList = [...added, ...changed, ...removed].sort();

for (const [label, list] of [
  ["added", added],
  ["updated", changed],
  ["removed", removed],
]) {
  for (const url of list.sort()) console.log(`${label.padEnd(7)} ${url}`);
}

if (urlList.length === 0) {
  console.log("indexnow: nothing changed since the last submission.");
  process.exit(0);
}

if (!submit) {
  console.log(
    `\nindexnow: ${urlList.length} URL(s) would be submitted. ` +
      `Re-run with --submit once the deployment is live.`,
  );
  process.exit(0);
}

// The key has to be fetchable before the submission is worth making: an
// engine validates by requesting it, and a 404 there fails the whole batch.
const keyUrl = `${SITE_URL}/${KEY}.txt`;
const probe = await fetch(keyUrl);
const served = probe.ok ? (await probe.text()).trim() : "";
if (served !== KEY) {
  console.error(
    `indexnow: ${keyUrl} returned ${probe.status} and ` +
      `${served ? "the wrong key" : "no key"}. Deploy first.`,
  );
  process.exit(1);
}

const response = await fetch(ENDPOINT, {
  method: "POST",
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify({
    host: HOST,
    key: KEY,
    keyLocation: keyUrl,
    urlList,
  }),
});

// 200 accepted, 202 accepted but the key is still being validated. Both
// mean the batch was taken; anything else means it was not, so the record
// must not advance or the next run would skip these URLs forever.
if (![200, 202].includes(response.status)) {
  console.error(
    `indexnow: ${ENDPOINT} answered ${response.status} ` +
      `${(await response.text()).slice(0, 200)}`,
  );
  process.exit(1);
}

writeFileSync(
  STATE,
  `${JSON.stringify(
    { submitted: new Date().toISOString().slice(0, 10), urls: now },
    null,
    2,
  )}\n`,
);

console.log(
  `indexnow: ${urlList.length} URL(s) submitted (HTTP ${response.status}); ` +
    `${STATE} updated — commit it.`,
);
