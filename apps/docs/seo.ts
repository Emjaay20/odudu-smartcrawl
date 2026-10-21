import { REPOSITORY_URL } from './nav';

export interface HeadTag {
  tagName: 'meta' | 'link';
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

// The icon file for browsers that do not read an SVG icon, the SVG icon, and
// the touch icon, in the order a browser should weigh them.
export function iconTags(base: string): HeadTag[] {
  return [
    {
      tagName: 'link',
      attributes: { rel: 'icon', href: `${base}brand/favicon.ico`, sizes: '48x48' },
    },
    // After the icon file and marked `any`, so a browser that reads an SVG
    // icon takes it, as the usual order lets it.
    {
      tagName: 'link',
      attributes: {
        rel: 'icon',
        href: `${base}brand/favicon.svg`,
        type: 'image/svg+xml',
        sizes: 'any',
      },
    },
    {
      tagName: 'link',
      attributes: { rel: 'apple-touch-icon', href: `${base}brand/apple-touch-icon.png` },
    },
  ];
}

// `<` is escaped so no value can close the script element that carries it.
export function landingJsonLd(siteUrl: string): string {
  const graph = [
    {
      '@type': 'SoftwareApplication',
      name: SITE_NAME,
      url: siteUrl,
      description:
        'A self-hosted OpenID Connect and OAuth 2.0 identity provider with an admin console and a command-line tool.',
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
const LINK_TAG = /<link\b[^>]*>/gu;
const REL = /\srel=(?:"([^"]*)"|'([^']*)'|([^\s>"']+))/u;
const PUBLIC_SIGNALS = [
  /<meta\b[^>]*\bproperty="?og:url"?[^>]*>/gu,
  /<script\b[^>]*\btype="?application\/ld\+json"?[^>]*>[\s\S]*?<\/script>/gu,
];

function isPublicLink(tag: string): boolean {
  const match = REL.exec(tag);
  const tokens = (match?.[1] ?? match?.[2] ?? match?.[3] ?? '').split(/\s+/u);
  return tokens.includes('canonical') || tokens.includes('alternate');
}

export function stripForImage(html: string): string {
  const links = html.replace(LINK_TAG, (tag) => (isPublicLink(tag) ? '' : tag));
  return PUBLIC_SIGNALS.reduce((text, pattern) => text.replace(pattern, ''), links);
}
