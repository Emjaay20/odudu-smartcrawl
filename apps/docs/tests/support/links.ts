import { existsSync } from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { fromMarkdown } from 'mdast-util-from-markdown';

interface MdNode {
  type: string;
  url?: string;
  value?: string;
  children?: MdNode[];
}

function walkTree(node: MdNode, visit: (node: MdNode) => void): void {
  visit(node);
  node.children?.forEach((child) => {
    walkTree(child, visit);
  });
}

// Every address a Markdown document points at, read by a CommonMark parser:
// links, images, reference definitions, autolinks and the attributes of raw HTML.
export function referencesOf(markdown: string): string[] {
  const found: string[] = [];
  walkTree(fromMarkdown(markdown), (node) => {
    if (node.url !== undefined) found.push(node.url);
    if (node.type === 'html' && node.value !== undefined) {
      const $ = cheerio.load(node.value, null, false);
      $('[href], [src]').each((_, element) => {
        const attributes = $(element).attr();
        for (const name of ['href', 'src']) {
          const value = attributes?.[name];
          if (value !== undefined) found.push(value);
        }
      });
    }
  });
  return found;
}

// What a document says apart from where it points: node types and their text.
export function shapeOf(markdown: string): string[] {
  const shape: string[] = [];
  walkTree(fromMarkdown(markdown), (node) => {
    if (node.type !== 'root') shape.push(`${node.type}:${node.value ?? ''}`);
  });
  return shape;
}

// Whether an address under the build's prefix names something the build wrote.
export function resolvesInBuild(dir: string, prefix: string, address: string): boolean {
  const pathname = decodeURIComponent(new URL(address, 'http://placeholder.test').pathname);
  const prefixPath = prefix.startsWith('/') ? prefix : new URL(prefix).pathname;
  const relative = pathname.slice(prefixPath.length);
  const file = relative === '' || relative.endsWith('/') ? `${relative}index.html` : relative;
  return existsSync(path.join(dir, file));
}

// The references that leave something unresolved: relative ones, and ones under
// the build's own prefix that name a file it did not write. Fragments and other hosts pass.
export function unresolved(markdown: string, dir: string, prefix: string): string[] {
  return referencesOf(markdown).filter((address) => {
    if (address.startsWith('#')) return false;
    if (address.startsWith(prefix)) return !resolvesInBuild(dir, prefix, address);
    return !/^(?:https?|mailto):/u.test(address);
  });
}
