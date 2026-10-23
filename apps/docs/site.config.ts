// The one place the site's address is written. Canonical and Open Graph URLs,
// the sitemap and the agent copies all derive from these values.
export const SITE_ORIGIN = process.env.DOCS_SITE_ORIGIN ?? 'https://wizzywit.github.io';
export const PAGES_BASE = process.env.DOCS_BASE ?? '/odudu/';

// Both builds expose the documentation at `<site root>docs/<page>/`. The Pages
// build has a landing at its root, so its docs plugin serves from `docs/`
// under its base; the image is mounted at `/docs/` by the server and its docs
// plugin serves from its own root. Nothing else lives under that directory.
export const DOCS_DIRECTORY = 'docs/';
export const IMAGE_BASE = `/${DOCS_DIRECTORY}`;
export const PAGES_DOCS_BASE = `${PAGES_BASE}${DOCS_DIRECTORY}`;

// Where the docs plugin serves from, relative to the build's base.
export function docsRoute(image: boolean): string {
  return image ? '' : DOCS_DIRECTORY;
}
