import { generateStaticParamsFor, importPage } from "nextra/pages";
import { useMDXComponents as getMDXComponents } from "../../mdx-components";
import { SITE_URL } from "../../lib/site.mjs";
import pages from "../../lib/pages.json";

export const generateStaticParams = generateStaticParamsFor("mdxPath");

export async function generateMetadata(props) {
  const params = await props.params;
  const { metadata } = await importPage(params.mdxPath);
  // One canonical URL per page.
  //
  // The optional catch-all serves `content/index.mdx` at both `/` and
  // `/index`, byte for byte, and Next prerenders both. Without a canonical
  // the front page is two indexable URLs with nothing saying which is the
  // page — so `/index` points at `/`, and every other route points at
  // itself. Resolved against `metadataBase` in the root layout.
  const path = (params.mdxPath ?? []).join("/");
  const route = path === "" ? "index" : path;
  return {
    ...metadata,
    alternates: {
      ...metadata.alternates,
      canonical: path === "index" ? "/" : `/${path}`,
      // The same page as Markdown, written into `public/` at build time by
      // `scripts/build-public-assets.mjs`. A reader who would rather have
      // the words than the document should not have to strip the document.
      types: { ...metadata.alternates?.types, "text/markdown": `/${route}.md` },
    },
  };
}

/**
 * BreadcrumbList for this route, or nothing.
 *
 * Derived from the path and titled from the same inventory the sidebar and
 * the sitemap are, so it cannot drift from what the page is called.
 *
 * It names only the levels that are pages. `production` and `receipts` are
 * folders in `content/`, not routes — Nextra expands them in the sidebar
 * rather than navigating to them — so there is no URL to give the middle
 * item, and every item but the last needs one. A middle item with a name
 * and no `item` is how a whole BreadcrumbList gets discarded as invalid,
 * which is a worse outcome than a shorter true one.
 */
function breadcrumbs(route) {
  if (route === "index") return null;
  const page = pages.find((p) => p.route === route);
  if (!page) return null;

  const trail = [
    { name: "The Fabrica — engineering documentation", url: `${SITE_URL}/` },
    { name: page.title, url: `${SITE_URL}${page.url}` },
  ];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

const Wrapper = getMDXComponents().wrapper;

export default async function Page(props) {
  const params = await props.params;
  const result = await importPage(params.mdxPath);
  const { default: MDXContent, toc, metadata } = result;
  const route = (params.mdxPath ?? []).join("/") || "index";
  const crumbs = breadcrumbs(route);
  return (
    <>
      {crumbs && (
        <script
          type="application/ld+json"
          // JSON.stringify over values this repository owns. Nothing here
          // comes from a request, so there is no untrusted input to escape.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }}
        />
      )}
      <Wrapper toc={toc} metadata={metadata}>
        <MDXContent {...props} params={params} />
      </Wrapper>
    </>
  );
}
