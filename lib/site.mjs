// The production host, in one place.
//
// Separate from `inventory.mjs` because this is the half that is safe to
// import from anything: the inventory reads the filesystem and imports the
// generated sidebar files, which is a Node script's job, not a bundled
// route's. `app/robots.js` needs the host and nothing else.
export const SITE_URL = "https://docs.thefabrica.dev";
