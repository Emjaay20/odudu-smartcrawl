import Layout from '@theme/Layout';
import SectionGrid from '@site/src/components/SectionGrid';
import type { ReactNode } from 'react';

// The documentation inside a running installation: no landing, only the sections.
export default function ImageHome(): ReactNode {
  return (
    <Layout
      title="Documentation"
      description="The Odudu documentation that ships with this installation."
    >
      <main className="container margin-vert--lg">
        <h1>Documentation</h1>
        <p>This is the documentation for the Odudu installation you are running.</p>
        <SectionGrid />
      </main>
    </Layout>
  );
}
