import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { mergeReports } from '#/merge-reports';

let dir: string | undefined;

afterEach(async () => {
  if (dir !== undefined) await rm(dir, { recursive: true, force: true });
  dir = undefined;
});

async function report(name: string, files: readonly string[]): Promise<string> {
  dir ??= await mkdtemp(join(tmpdir(), 'odudu-ci-reports-'));
  const path = join(dir, name);
  const testResults = files.map((file) => ({
    name: file,
    assertionResults: [{ fullName: `${file} test`, status: 'passed' }],
  }));
  await writeFile(path, JSON.stringify({ numTotalTests: files.length, testResults }));
  return path;
}

describe('mergeReports', () => {
  it('joins the files of every shard into one report the trace check reads', async () => {
    const a = await report('a.json', ['one.test.ts', 'two.test.ts']);
    const b = await report('b.json', ['three.test.ts']);
    const out = join(dir ?? '', 'merged.json');
    await mergeReports(out, [a, b]);
    const merged = JSON.parse(await readFile(out, 'utf8')) as {
      testResults: { name: string }[];
    };
    expect(merged.testResults.map((r) => r.name)).toEqual([
      'one.test.ts',
      'two.test.ts',
      'three.test.ts',
    ]);
  });

  it('refuses a file with no testResults rather than merging a hole', async () => {
    const bad = join(await mkdtemp(join(tmpdir(), 'odudu-ci-reports-')), 'bad.json');
    dir = join(bad, '..');
    await writeFile(bad, JSON.stringify({ numTotalTests: 0 }));
    await expect(mergeReports(join(dir, 'out.json'), [bad])).rejects.toThrow(/testResults/u);
  });

  it('refuses an empty list', async () => {
    await expect(mergeReports('out.json', [])).rejects.toThrow(/no report/u);
  });
});
