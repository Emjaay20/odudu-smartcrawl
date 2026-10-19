import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Plugin } from '@docusaurus/types';

const SIGNALS = [
  /<link\b[^>]*\brel="?(?:canonical|alternate)"?[^>]*>/gu,
  /<meta\b[^>]*\bproperty="?og:url"?[^>]*>/gu,
  /<script\b[^>]*\btype="?application\/ld\+json"?[^>]*>[\s\S]*?<\/script>/gu,
];

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

// The theme emits canonical, hreflang, og:url and JSON-LD whatever the config
// says; a private installation's copy of the pages must carry none of them.
export default function imageStrip(): Plugin {
  return {
    name: 'odudu-image-strip',
    async postBuild({ outDir }) {
      for (const file of await htmlFiles(outDir)) {
        const html = await readFile(file, 'utf8');
        const stripped = SIGNALS.reduce((text, pattern) => text.replace(pattern, ''), html);
        if (stripped !== html) await writeFile(file, stripped);
      }
    },
  };
}
