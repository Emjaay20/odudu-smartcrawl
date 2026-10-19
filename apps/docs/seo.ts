import { REPOSITORY_URL } from './nav';

export interface HeadTag {
  tagName: 'meta';
  attributes: Record<string, string>;
}

export const SITE_NAME = 'Odudu';

// Site-wide tags the theme does not emit. Per-page ones (title, description,
// canonical, og:url, breadcrumbs) come from the theme and the page.
export function siteHeadTags(): HeadTag[] {
  return [
    { tagName: 'meta', attributes: { property: 'og:site_name', content: SITE_NAME } },
    { tagName: 'meta', attributes: { property: 'og:type', content: 'website' } },
  ];
}

// `<` is escaped so no value can close the script element that carries it.
export function landingJsonLd(siteUrl: string): string {
  const graph = [
    {
      '@type': 'SoftwareApplication',
      name: SITE_NAME,
      url: siteUrl,
      applicationCategory: 'SecurityApplication',
      operatingSystem: 'Any system that runs a container',
      license: 'https://www.gnu.org/licenses/agpl-3.0.html',
      isAccessibleForFree: true,
    },
    {
      '@type': 'Organization',
      name: SITE_NAME,
      url: siteUrl,
      logo: `${siteUrl}brand/favicon.svg`,
      sameAs: [REPOSITORY_URL],
    },
  ];
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(
    /</gu,
    '\\u003c',
  );
}

// The theme emits these whatever the configuration says, and a private
// installation's copy of the pages must carry none of them. The build's
// minifier may have dropped the attribute quotes.
const PUBLIC_SIGNALS = [
  /<link\b[^>]*\brel="?(?:canonical|alternate)"?[^>]*>/gu,
  /<meta\b[^>]*\bproperty="?og:url"?[^>]*>/gu,
  /<script\b[^>]*\btype="?application\/ld\+json"?[^>]*>[\s\S]*?<\/script>/gu,
];

export function stripForImage(html: string): string {
  return PUBLIC_SIGNALS.reduce((text, pattern) => text.replace(pattern, ''), html);
}
