import Layout from '@theme/Layout';
import type { ReactElement } from 'react';
import { DocsHome } from '@site/src/features/docs-home';

// The documentation inside a running installation, in the image build.
export default function ImageHome(): ReactElement {
  return (
    <Layout
      title="Documentation"
      description="The Odudu documentation that ships with this installation."
    >
      <DocsHome audience="installation" />
    </Layout>
  );
}
