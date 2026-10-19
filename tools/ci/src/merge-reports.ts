import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

interface Slice {
  path: string;
  index: number;
  count: number;
}

async function resultsOf(path: string): Promise<unknown[]> {
  const report: unknown = JSON.parse(await readFile(path, 'utf8'));
  const results = (report as { testResults?: unknown }).testResults;
  if (!Array.isArray(results)) throw new Error(`${path}: no testResults array`);
  return results as unknown[];
}

// The workflow writes `i/n` (the same value ODUDU_TEST_SHARD had) beside each
// report, so the expected count travels with the slice that ran.
async function sliceOf(path: string): Promise<Slice> {
  const file = join(dirname(path), 'trace-shard');
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    throw new Error(`${file}: a report must name its slice`, { cause: error });
  }
  const match = /^(\d+)\/(\d+)$/u.exec(text.trim());
  if (match?.[1] === undefined || match[2] === undefined) {
    throw new Error(`${file}: expected "i/n", found "${text.trim()}"`);
  }
  return { path, index: Number(match[1]), count: Number(match[2]) };
}

// Each slice of a package writes its own vitest JSON report; the trace check
// reads one per package and only the per-file assertion results from it. A
// slice that is missing, repeated or counted differently fails the merge: a
// package reconciled from part of its tests would pass for the wrong reason.
export async function mergeReports(out: string, reports: readonly string[]): Promise<void> {
  if (reports.length === 0) throw new Error('no report to merge');
  const slices = await Promise.all(reports.map(sliceOf));
  const counts = new Set(slices.map((s) => s.count));
  if (counts.size !== 1) {
    throw new Error(`the slices disagree about the count: ${[...counts].join(', ')}`);
  }
  const count = slices[0]?.count ?? 0;
  const found = slices.map((s) => s.index).sort((a, b) => a - b);
  const wanted = Array.from({ length: count }, (_, i) => i + 1);
  if (found.join(',') !== wanted.join(',')) {
    throw new Error(`expected slices 1..${String(count)}, found ${found.join(', ')}`);
  }
  slices.sort((a, b) => a.index - b.index);
  const testResults: unknown[] = [];
  for (const { path } of slices) testResults.push(...(await resultsOf(path)));
  await writeFile(out, JSON.stringify({ testResults }));
}
