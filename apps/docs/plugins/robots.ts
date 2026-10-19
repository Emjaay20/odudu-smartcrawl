import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Plugin } from '@docusaurus/types';

// The Pages build names its sitemap; the image's pages are private to the
// installation and say so. Crawlers read only a robots.txt at the host's root,
// so under a project path this is for whoever fetches it by hand.
export default function robots(): Plugin {
  return {
    name: 'odudu-robots',
    async postBuild({ outDir, siteConfig }) {
      const isImage = process.env['DOCS_TARGET'] === 'image';
      const sitemap = `${siteConfig.url}${siteConfig.baseUrl}sitemap.xml`;
      const text = isImage
        ? 'User-agent: *\nDisallow: /\n'
        : `User-agent: *\nAllow: /\n\nSitemap: ${sitemap}\n`;
      await writeFile(path.join(outDir, 'robots.txt'), text);
    },
  };
}
