import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { landingJsonLd } from '@site/seo';
import useReveal from '@site/src/features/landing/usecase/useReveal';

export interface LandingPage {
  // True once the reveal has taken hold; the page marks itself for the stylesheet.
  motion: boolean;
  jsonLd: string;
}

export function useLandingPage(): LandingPage {
  const { siteConfig } = useDocusaurusContext();
  return {
    motion: useReveal(),
    jsonLd: landingJsonLd(`${siteConfig.url}${siteConfig.baseUrl}`),
  };
}
