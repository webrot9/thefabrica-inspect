import { generateStaticParamsFor, importPage } from "nextra/pages";
import { useMDXComponents as getMDXComponents } from "../../mdx-components";

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
  return {
    ...metadata,
    alternates: {
      ...metadata.alternates,
      canonical: path === "index" ? "/" : `/${path}`,
    },
  };
}

const Wrapper = getMDXComponents().wrapper;

export default async function Page(props) {
  const params = await props.params;
  const result = await importPage(params.mdxPath);
  const { default: MDXContent, toc, metadata } = result;
  return (
    <Wrapper toc={toc} metadata={metadata}>
      <MDXContent {...props} params={params} />
    </Wrapper>
  );
}
