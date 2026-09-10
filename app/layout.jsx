import { Footer, Layout, Navbar } from "nextra-theme-docs";
import { Head } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import "nextra-theme-docs/style.css";

export const metadata = {
  title: {
    default: "The Fabrica — engineering documentation",
    template: "%s — The Fabrica",
  },
  description:
    "The engineering reasoning behind The Fabrica, a production FastAPI + " +
    "Next.js SaaS foundation. Published from the private repository, not " +
    "retyped from it.",
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
      Every page under a section heading is generated from the private
      repository and says which commit it came from.{" "}
      <a href="https://www.thefabrica.dev/">thefabrica.dev</a>
    </span>
  </Footer>
);

export default async function RootLayout({ children }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head />
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
          // No "last updated" either. Each page already states the commit
          // it was extracted from; a second, different date — the date the
          // export happened to be committed here — would contradict it.
          lastUpdated={null}
          sidebar={{ defaultMenuCollapseLevel: 1 }}
        >
          {children}
        </Layout>
      </body>
    </html>
  );
}
