import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Plugin } from '@docusaurus/types';
import { stripForNotFound } from '../seo';

// The theme gives `404.html` a canonical address of its own, `<base>404.html/`.
export default function notFound(): Plugin {
  return {
    name: 'odudu-not-found',
    async postBuild({ outDir }) {
      const file = path.join(outDir, '404.html');
      await writeFile(file, stripForNotFound(await readFile(file, 'utf8')));
    },
  };
}
