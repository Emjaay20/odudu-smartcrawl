import Layout from '@theme/Layout';
import type { ReactElement } from 'react';
import { LandingPage } from '@site/src/features/landing';

// Docusaurus's route for `/`: the theme's header and footer around the landing page.
export default function Home(): ReactElement {
  return (
    <Layout
      title="A self-hosted OpenID Connect identity provider"
      description="Odudu is an OpenID Connect and OAuth 2.0 identity provider you run yourself: one container and Postgres, an admin console and a command-line tool."
    >
      <LandingPage />
    </Layout>
  );
}
