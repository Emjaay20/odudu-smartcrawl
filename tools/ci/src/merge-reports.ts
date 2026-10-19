import { readFile, writeFile } from 'node:fs/promises';

async function resultsOf(path: string): Promise<unknown[]> {
  const report: unknown = JSON.parse(await readFile(path, 'utf8'));
  const results = (report as { testResults?: unknown }).testResults;
  if (!Array.isArray(results)) throw new Error(`${path}: no testResults array`);
  return results as unknown[];
}

// Each shard of a package writes its own vitest JSON report; the trace check
// reads one per package and only the per-file assertion results from it.
export async function mergeReports(out: string, shards: readonly string[]): Promise<void> {
  if (shards.length === 0) throw new Error('no report to merge');
  const testResults: unknown[] = [];
  for (const path of shards) testResults.push(...(await resultsOf(path)));
  await writeFile(out, JSON.stringify({ testResults }));
}
