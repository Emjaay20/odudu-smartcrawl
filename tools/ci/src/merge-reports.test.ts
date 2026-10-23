import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { mergeReports } from '#/merge-reports';

let dir: string | undefined;

afterEach(async () => {
  if (dir !== undefined) await rm(dir, { recursive: true, force: true });
  dir = undefined;
});

// A slice's report sits beside a `trace-shard` file naming the slice, as the
// workflow writes them.
async function report(
  name: string,
  shard: string | undefined,
  files: readonly string[],
): Promise<string> {
  dir ??= await mkdtemp(join(tmpdir(), 'odudu-ci-reports-'));
  await mkdir(join(dir, name));
  const path = join(dir, name, 'trace-report.json');
  const testResults = files.map((file) => ({
    name: file,
    assertionResults: [{ fullName: `${file} test`, status: 'passed' }],
  }));
  await writeFile(path, JSON.stringify({ numTotalTests: files.length, testResults }));
  if (shard !== undefined) await writeFile(join(dir, name, 'trace-shard'), `${shard}\n`);
  return path;
}

async function merged(out: string): Promise<string[]> {
  const parsed = JSON.parse(await readFile(out, 'utf8')) as { testResults: { name: string }[] };
  return parsed.testResults.map((r) => r.name);
}

describe('mergeReports', () => {
  it('joins the files of every shard into one report the trace check reads', async () => {
    const a = await report('a', '1/2', ['one.test.ts', 'two.test.ts']);
    const b = await report('b', '2/2', ['three.test.ts']);
    const out = join(dir ?? '', 'merged.json');
    await mergeReports(out, [b, a]);
    expect(await merged(out)).toEqual(['one.test.ts', 'two.test.ts', 'three.test.ts']);
  });

  it('takes a package that was never sliced as one slice of one', async () => {
    const only = await report('only', '1/1', ['a.test.ts']);
    const out = join(dir ?? '', 'merged.json');
    await mergeReports(out, [only]);
    expect(await merged(out)).toEqual(['a.test.ts']);
  });

  it('fails when a slice is missing', async () => {
    const a = await report('a', '1/3', ['one.test.ts']);
    const c = await report('c', '3/3', ['three.test.ts']);
    await expect(mergeReports(join(dir ?? '', 'out.json'), [a, c])).rejects.toThrow(
      /expected slices 1\.\.3.*found 1, 3/u,
    );
  });

  it('fails on a slice that appears twice or beyond the count', async () => {
    const a = await report('a', '1/2', ['one.test.ts']);
    const again = await report('again', '1/2', ['one.test.ts']);
    await expect(mergeReports(join(dir ?? '', 'out.json'), [a, again])).rejects.toThrow(
      /expected slices/u,
    );
  });

  it('fails when the slices disagree about how many there are', async () => {
    const a = await report('a', '1/2', ['one.test.ts']);
    const b = await report('b', '2/3', ['two.test.ts']);
    await expect(mergeReports(join(dir ?? '', 'out.json'), [a, b])).rejects.toThrow(/count/u);
  });

  it('fails when a report names no slice', async () => {
    const a = await report('a', undefined, ['one.test.ts']);
    await expect(mergeReports(join(dir ?? '', 'out.json'), [a])).rejects.toThrow(/trace-shard/u);
  });

  it('refuses a file with no testResults rather than merging a hole', async () => {
    dir = await mkdtemp(join(tmpdir(), 'odudu-ci-reports-'));
    await mkdir(join(dir, 'bad'));
    const bad = join(dir, 'bad', 'trace-report.json');
    await writeFile(bad, JSON.stringify({ numTotalTests: 0 }));
    await writeFile(join(dir, 'bad', 'trace-shard'), '1/1');
    await expect(mergeReports(join(dir, 'out.json'), [bad])).rejects.toThrow(/testResults/u);
  });

  it('refuses an empty list', async () => {
    await expect(mergeReports('out.json', [])).rejects.toThrow(/no report/u);
  });
});
