import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { LoadContext, Plugin } from '@docusaurus/types';
import llms from 'docusaurus-plugin-llms';
import { MACHINE_READABLE_REFERENCES } from '../nav';
import { parseEntries } from './agent-entries';
import { rewriteLinks, type LinkTarget } from './agent-links';
import { dropRepeatedTitle } from './agent-title';
import { appendReferences } from './agent-references';

export interface AgentCopiesOptions {
  docsDir: string;
  useRelativeUrls: boolean;
  title: string;
  description: string;
}

const SECTION_BREAK = /\n\n---\n\n(?=## )/u;
const FIRST_SECTION = /\n\n(?=## )/u;

function sourceOf(docsRoot: string, copy: string): string {
  const stem = copy.replace(/\.md$/u, '');
  const found = [`${stem}.md`, `${stem}/index.md`].find((candidate) =>
    existsSync(path.join(docsRoot, candidate)),
  );
  if (found === undefined) throw new Error(`No source page for the Markdown copy ${copy}`);
  return found;
}

// The plugin leaves a page's links as the author wrote them, which only
// resolve beside the source file, so the copies are rewritten once it is done.
// Running both in one postBuild keeps the order: plugins' postBuild hooks run
// concurrently with each other.
export default function agentCopies(
  context: LoadContext,
  options: AgentCopiesOptions,
): Plugin<void> {
  const inner = llms(context, { ...options, generateMarkdownFiles: true });
  return {
    ...inner,
    name: 'odudu-agent-copies',
    async postBuild(props) {
      await inner.postBuild?.(props);
      const { outDir, siteConfig, siteDir } = props;
      const docsRoot = path.resolve(siteDir, options.docsDir);
      const target: LinkTarget = {
        base: siteConfig.baseUrl,
        origin: options.useRelativeUrls ? null : siteConfig.url,
      };
      const prefix = `${target.origin ?? ''}${target.base}`;

      const llmsFile = path.join(outDir, 'llms.txt');
      const llmsText = await readFile(llmsFile, 'utf8');
      const copies = parseEntries(llmsText).map(({ title, url }) => {
        if (!url.startsWith(prefix)) throw new Error(`llms.txt lists ${url} outside ${prefix}`);
        return { title, copy: url.slice(prefix.length) };
      });

      const sources = new Map(copies.map(({ copy }) => [copy, sourceOf(docsRoot, copy)]));
      for (const { copy, title } of copies) {
        const file = path.join(outDir, copy);
        const source = sources.get(copy) ?? '';
        const text = dropRepeatedTitle(await readFile(file, 'utf8'), title, 1);
        await writeFile(file, rewriteLinks(text, source, target));
      }

      const fullFile = path.join(outDir, 'llms-full.txt');
      const full = await readFile(fullFile, 'utf8');
      const [preamble = '', ...rest] = full.split(FIRST_SECTION);
      const sections = rest.join('\n\n').split(SECTION_BREAK);
      if (sections.length !== copies.length) {
        throw new Error(
          `llms-full.txt has ${String(sections.length)} sections for ${String(copies.length)} pages`,
        );
      }
      const rewritten = sections.map((section, index) => {
        const entry = copies[index];
        if (entry === undefined || !section.startsWith(`## ${entry.title}\n`)) {
          throw new Error(
            `llms-full.txt section ${String(index)} is not ${entry?.title ?? 'a page'}`,
          );
        }
        return rewriteLinks(
          dropRepeatedTitle(section, entry.title, 2),
          sources.get(entry.copy) ?? '',
          target,
        );
      });
      await writeFile(fullFile, `${preamble}\n\n${rewritten.join('\n\n---\n\n')}`);

      for (const reference of MACHINE_READABLE_REFERENCES) {
        if (!existsSync(path.join(outDir, reference.file))) {
          throw new Error(`Machine-readable reference ${reference.file} was not written`);
        }
      }
      await writeFile(llmsFile, appendReferences(llmsText, MACHINE_READABLE_REFERENCES, prefix));
    },
  };
}
