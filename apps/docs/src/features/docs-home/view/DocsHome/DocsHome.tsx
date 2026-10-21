import type { ReactElement } from 'react';
import { HomeMap } from '@site/src/features/docs-home/view/HomeMap/HomeMap';

// The documentation inside a running installation: no landing, only the way through it.
export function DocsHome(): ReactElement {
  return (
    <main className="container margin-vert--lg" data-page="docs-home">
      <h1>Documentation</h1>
      <p>
        This is the documentation for the Odudu installation you are running. It walks from a
        running server to signed-in users and an administrator who can manage them.
      </p>
      <HomeMap />
    </main>
  );
}
