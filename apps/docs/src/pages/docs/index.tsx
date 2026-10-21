import Layout from '@theme/Layout';
import type { ReactElement } from 'react';
import { DocsHome } from '@site/src/features/docs-home';

// The public site's `docs/` page, which the docs plugin serves nothing at.
export default function PublicDocsHome(): ReactElement {
  return (
    <Layout
      title="Documentation"
      description="Start with the quick start, follow a guide, or look up an endpoint, a setting or an error in the Odudu documentation."
    >
      <DocsHome audience="public" />
    </Layout>
  );
}
