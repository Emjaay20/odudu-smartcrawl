import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');

async function read(file: string): Promise<string> {
  return readFile(path.join(REPO_ROOT, file), 'utf8');
}

function jobNames(workflow: string): string[] {
  const jobs = workflow.slice(workflow.indexOf('\njobs:\n'));
  return [...jobs.matchAll(/^ {2}([a-z][\w-]*):\s*$/gmu)].map((m) => m[1] ?? '');
}

function gateNeeds(workflow: string): string[] {
  const gate = workflow.slice(workflow.indexOf('\n  gate:\n'));
  const block = /needs:\n((?: {6}- [\w-]+\n)+)/u.exec(gate)?.[1] ?? '';
  return [...block.matchAll(/- ([\w-]+)/gu)].map((m) => m[1] ?? '');
}

describe('the CI workflow', () => {
  it('has a gate that waits for every other job, so no job can be added outside it', async () => {
    const workflow = await read('.github/workflows/verify.yml');
    const others = jobNames(workflow).filter((name) => name !== 'gate');
    expect(others.length).toBeGreaterThan(5);
    expect(gateNeeds(workflow).sort()).toEqual(others.sort());
  });

  it('hashes the shard into every test task, or a slice would replay another slice from cache', async () => {
    const turbo: unknown = JSON.parse(await read('turbo.json'));
    const tasks = (turbo as { tasks: Record<string, { env?: string[] }> }).tasks;
    const missing = Object.entries(tasks)
      .filter(([name]) => name === 'test' || name.endsWith('#test'))
      .filter(([, task]) => !(task.env ?? []).includes('ODUDU_TEST_SHARD'))
      .map(([name]) => name);
    expect(missing).toEqual([]);
  });

  it('gives each shard of a package a slice that vitest accepts', async () => {
    const workflow = await read('.github/workflows/verify.yml');
    const shards = [...workflow.matchAll(/package: '([^']+)', shard: '([^']*)'/gu)];
    expect(shards.length).toBeGreaterThan(0);
    const byPackage = new Map<string, string[]>();
    for (const [, pkg = '', shard = ''] of shards) {
      byPackage.set(pkg, [...(byPackage.get(pkg) ?? []), shard]);
    }
    for (const [pkg, slices] of byPackage) {
      const counts = new Set(slices.map((s) => s.split('/')[1]));
      expect(counts.size, `${pkg} mixes shard counts`).toBe(1);
      const count = Number([...counts][0] ?? '1');
      const indexes = slices.map((s) => (s === '' ? 1 : Number(s.split('/')[0])));
      expect(indexes.sort(), pkg).toEqual(Array.from({ length: count }, (_, i) => i + 1));
    }
  });
});
