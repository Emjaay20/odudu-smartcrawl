import Layout from '@theme/Layout';
import HomeMap from '@site/src/components/HomeMap';
import type { ReactNode } from 'react';

// The documentation inside a running installation: no landing, only the way through it.
export default function ImageHome(): ReactNode {
  return (
    <Layout
      title="Documentation"
      description="The Odudu documentation that ships with this installation."
    >
      <main className="container margin-vert--lg" data-page="docs-home">
        <h1>Documentation</h1>
        <p>
          This is the documentation for the Odudu installation you are running. It walks from a
          running server to signed-in users and an administrator who can manage them.
        </p>
        <HomeMap />
      </main>
    </Layout>
  );
}
