import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Plugin } from '@docusaurus/types';
import { stripForImage } from '../seo';

async function htmlFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return htmlFiles(full);
      return entry.name.endsWith('.html') ? [full] : [];
    }),
  );
  return nested.flat();
}

export default function imageStrip(): Plugin {
  return {
    name: 'odudu-image-strip',
    async postBuild({ outDir }) {
      for (const file of await htmlFiles(outDir)) {
        const html = await readFile(file, 'utf8');
        const stripped = stripForImage(html);
        if (stripped !== html) await writeFile(file, stripped);
      }
    },
  };
}
