import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { docsPolicy, parseDocsCsp } from '@odudu/web-assets';
import { computeCsp, writeCsp } from './csp.ts';

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function sha256(text: string): string {
  return `sha256-${createHash('sha256').update(text).digest('base64')}`;
}

async function site(pages: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'csp-'));
  dirs.push(dir);
  for (const [name, html] of Object.entries(pages)) {
    await mkdir(path.dirname(path.join(dir, name)), { recursive: true });
    await writeFile(path.join(dir, name), html);
  }
  return dir;
}

describe('computeCsp', () => {
  it('hashes the exact text of each executable inline script, once per distinct body', async () => {
    const init = '(function(){var t=1})();';
    const dir = await site({
      'index.html': `<html><head><script>${init}</script></head><body></body></html>`,
      'a/index.html': `<html><head><script>${init}</script><script src="/docs/x.js"></script></head></html>`,
    });
    expect(computeCsp(dir).scriptHashes).toEqual([sha256(init)]);
  });

  it('hashes a script whose text has a newline or a quote byte for byte', async () => {
    const body = `\n  var a = "x";\n  var b = 'y';\n`;
    const dir = await site({ 'index.html': `<script>${body}</script>` });
    expect(computeCsp(dir).scriptHashes).toEqual([sha256(body)]);
  });

  it('skips a data block, which the browser does not execute', async () => {
    const dir = await site({
      'index.html':
        '<script type="application/ld+json">{"@type":"X"}</script><script type="application/json">{}</script>',
    });
    expect(computeCsp(dir).scriptHashes).toEqual([]);
  });

  it('hashes a module script and an import map, which a policy governs', async () => {
    const dir = await site({
      'index.html':
        '<script type="module">import "./x.js"</script><script type="importmap">{}</script>',
    });
    expect(computeCsp(dir).scriptHashes).toEqual([sha256('import "./x.js"'), sha256('{}')].sort());
  });

  it('hashes the decoded value of every style attribute, sorted and without repeats', async () => {
    const dir = await site({
      'index.html':
        '<div style="display:none"></div><p style="color:#fff;background:url(&quot;x&quot;)"></p>',
      'b/index.html': '<span style="display:none"></span>',
    });
    expect(computeCsp(dir).styleAttributeHashes).toEqual(
      [sha256('display:none'), sha256('color:#fff;background:url("x")')].sort(),
    );
  });

  it('reads an unquoted attribute the way the minifier writes it', async () => {
    const dir = await site({ 'index.html': '<div style=display:none></div>' });
    expect(computeCsp(dir).styleAttributeHashes).toEqual([sha256('display:none')]);
  });

  it('reaches HTML in every directory and ignores other files', async () => {
    const dir = await site({
      'a/b/c/index.html': '<script>deep()</script>',
      'notes.txt': '<script>not html()</script>',
      'x.js': '<script>nor this()</script>',
    });
    expect(computeCsp(dir).scriptHashes).toEqual([sha256('deep()')]);
  });

  it.each([
    ['a style element', '<style>body{margin:0}</style>', /<style>/u],
    ['an inline event handler', '<a href="/" onclick="x()">a</a>', /onclick/u],
    ['a javascript: URL', '<a href="javascript:x()">a</a>', /javascript:/u],
  ])('refuses %s, which no hash in this policy licenses', async (_why, html, message) => {
    const dir = await site({ 'index.html': html });
    expect(() => computeCsp(dir)).toThrow(message);
  });

  it('names the file that carries what it refuses', async () => {
    const dir = await site({ 'deep/index.html': '<style>x{}</style>' });
    expect(() => computeCsp(dir)).toThrow(/deep[/\\]index\.html/u);
  });
});

describe('writeCsp', () => {
  it('writes csp.json beside the build, in the shape the server reads', async () => {
    const dir = await site({ 'index.html': '<script>go()</script><i style="top:0"></i>' });
    writeCsp(dir);
    expect(JSON.parse(await readFile(path.join(dir, 'csp.json'), 'utf8'))).toEqual({
      scriptHashes: [sha256('go()')],
      styleAttributeHashes: [sha256('top:0')],
    });
  });
});

// The file the image build wrote is what the server reads at boot, so it has to
// be what the server accepts: a malformed hash would make /docs/* answer 503.
describe('the image build’s csp.json', () => {
  const built = path.resolve(import.meta.dirname, '../dist/image/csp.json');

  it('is accepted by the server and makes a policy with no unsafe source', async () => {
    const hashes = parseDocsCsp(JSON.parse(await readFile(built, 'utf8')));
    const policy = docsPolicy(hashes);
    expect(hashes.scriptHashes).toHaveLength(1);
    expect(policy).toContain(hashes.scriptHashes[0] ?? 'missing');
    expect(policy).not.toMatch(/unsafe-inline|unsafe-eval/u);
  });
});
