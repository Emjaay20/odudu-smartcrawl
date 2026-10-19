import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import { themes } from 'prism-react-renderer';
import imageStrip from './plugins/image-strip';
import { NAVBAR_ROUTES, REPOSITORY_URL, SECTIONS } from './nav';
import { PAGES_BASE, SITE_ORIGIN } from './site.config';

const image = process.env.DOCS_TARGET === 'image';

const preset: Preset.Options = {
  docs: { path: 'content/en', routeBasePath: '/', sidebarPath: './sidebars.ts' },
  blog: false,
  pages: { path: image ? 'src/image-pages' : 'src/pages' },
  sitemap: image ? false : { ignorePatterns: ['**/search/**'] },
  theme: { customCss: './src/css/custom.css' },
};

const themeConfig: Preset.ThemeConfig = {
  navbar: {
    title: 'Odudu',
    items: [
      ...NAVBAR_ROUTES.flatMap((route) => {
        const section = SECTIONS.find((candidate) => candidate.route === route);
        return section === undefined
          ? []
          : [{ to: `/${route}`, label: section.label, position: 'left' as const }];
      }),
      { href: REPOSITORY_URL, label: 'GitHub', position: 'right' },
    ],
  },
  footer: {
    style: 'dark',
    links: [
      {
        title: 'Documentation',
        items: SECTIONS.map((section) => ({ label: section.label, to: `/${section.route}` })),
      },
      { title: 'Project', items: [{ label: 'GitHub', href: REPOSITORY_URL }] },
    ],
    copyright: 'Odudu is open source under the AGPL-3.0.',
  },
  prism: { theme: themes.github, darkTheme: themes.dracula },
  colorMode: { respectPrefersColorScheme: true },
};

const config: Config = {
  title: 'Odudu',
  // The image names no public address: the theme needs a URL, and it is bundled.
  url: image ? 'http://localhost' : SITE_ORIGIN,
  baseUrl: image ? '/docs/' : PAGES_BASE,
  trailingSlash: true,
  favicon: 'brand/favicon.svg',
  baseUrlIssueBanner: false,
  onBrokenLinks: 'throw',
  onBrokenAnchors: 'throw',
  future: { v4: true },
  markdown: { format: 'detect', hooks: { onBrokenMarkdownLinks: 'throw' } },
  i18n: { defaultLocale: 'en', locales: ['en'] },
  headTags: image ? [{ tagName: 'meta', attributes: { name: 'robots', content: 'noindex' } }] : [],
  themes: [
    [
      '@easyops-cn/docusaurus-search-local',
      {
        hashed: true,
        indexDocs: true,
        indexBlog: false,
        indexPages: !image,
        // The image's pages say noindex to crawlers; its own search must still read them.
        forceIgnoreNoIndex: image,
        docsRouteBasePath: '/',
        docsDir: 'content/en',
      },
    ],
  ],
  plugins: image ? [imageStrip] : [],
  presets: [['classic', preset]],
  themeConfig,
};

export default config;
