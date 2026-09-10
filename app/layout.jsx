import { Footer, Layout, Navbar } from "nextra-theme-docs";
import { Head } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import "nextra-theme-docs/style.css";

export const metadata = {
  // The production host, so canonical and social URLs resolve against the
  // site rather than against Next's localhost fallback.
  metadataBase: new URL("https://docs.thefabrica.dev"),
  title: {
    default: "The Fabrica — engineering documentation",
    template: "%s — The Fabrica",
  },
  description:
    "The engineering reasoning behind The Fabrica, a production FastAPI + " +
    "Next.js SaaS foundation: the decisions, the trade-offs, and the " +
    "receipts.",
};

const navbar = (
  <Navbar
    logo={<b>The Fabrica</b>}
    projectLink="https://github.com/webrot9/thefabrica-inspect"
  />
);

const footer = (
  <Footer>
    <span>
      Every page under a section heading is generated from the product
      documentation and names the version it describes.{" "}
      <a href="https://www.thefabrica.dev/">thefabrica.dev</a>
    </span>
  </Footer>
);

export default async function RootLayout({ children }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head>
        {/* The curated map of this site for a machine reading it: what The
            Fabrica is, then the pages grouped the way the sidebar groups
            them. `describedby` is the honest relation — llms.txt describes
            the site, it is not an alternate representation of any one
            page, which is what `alternate` would claim. React hoists this
            into <head> like any other link element. */}
        <link rel="describedby" type="text/plain" href="/llms.txt" />
      </Head>
      <body>
        <Layout
          navbar={navbar}
          footer={footer}
          pageMap={await getPageMap()}
          docsRepositoryBase="https://github.com/webrot9/thefabrica-inspect/tree/main"
          // No "edit this page": almost every page here is generated, and
          // the edit that matters happens in a repository the reader
          // cannot see. CONTRIBUTING.md says where to go instead.
          editLink={null}
          sidebar={{ defaultMenuCollapseLevel: 1 }}
        >
          {children}
        </Layout>
      </body>
    </html>
  );
}
