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

  it('runs the gate whatever happened upstream, and fails it when changes decided nothing', async () => {
    const workflow = await read('.github/workflows/verify.yml');
    const gate = workflow.slice(workflow.indexOf('\n  gate:\n'));
    expect(gate).toMatch(/^ {4}if: always\(\)$/mu);
    expect(gate).toContain('needs.changes.outputs.server');
    expect(gate).toContain('changes wrote no outputs');
  });

  it('has verify wait for each of its parts', async () => {
    const workflow = await read('.github/workflows/verify.yml');
    const verify = workflow.slice(workflow.indexOf('\n  verify:\n'));
    expect(verify).toMatch(/needs: \[static, test, test-rest, trace\]/u);
    expect(verify).toMatch(/^ {4}if: always\(\)$/mu);
  });

  it('leaves test-rest exactly the packages the matrix and the docs job do not run', async () => {
    const workflow = await read('.github/workflows/verify.yml');
    const sliced = new Set(
      [...workflow.matchAll(/package: '([^']+)', shard:/gu)].map((m) => m[1] ?? ''),
    );
    const filter = /FILTER: .*&& '([^']+)' \|\|/u.exec(workflow)?.[1] ?? '';
    const excluded = [...filter.matchAll(/--filter=!(\S+)/gu)].map((m) => m[1] ?? '');
    expect(excluded.sort()).toEqual([...sliced, '@odudu/docs'].sort());
  });

  it('fails an upload of a test report that finds no file', async () => {
    const workflow = await read('.github/workflows/verify.yml');
    const uploads = [...workflow.matchAll(/name: trace-[^\n]*\n(?: {10}[^\n]*\n)+/gu)];
    expect(uploads.length).toBe(3);
    for (const [upload] of uploads) {
      expect(upload).toContain('if-no-files-found: error');
    }
  });

  describe('the console e2e job', () => {
    async function e2eShards(): Promise<string[]> {
      const workflow = await read('.github/workflows/verify.yml');
      const job = workflow.slice(workflow.indexOf('\n  e2e-shards:\n'));
      const line = /shard: \[([^\]]*)\]/u.exec(job)?.[1] ?? '';
      return [...line.matchAll(/'([^']*)'/gu)].map((m) => m[1] ?? '');
    }

    it('cuts the specs into slices playwright accepts, each of them run once', async () => {
      const slices = await e2eShards();
      expect(slices.length).toBeGreaterThan(1);
      const totals = new Set(slices.map((s) => s.split('/')[1]));
      expect(totals.size).toBe(1);
      const total = Number([...totals][0]);
      expect(slices.map((s) => Number(s.split('/')[0])).sort()).toEqual(
        Array.from({ length: total }, (_, i) => i + 1),
      );
    });

    it('takes the slice from the matrix alone, and run.sh passes it on to playwright', async () => {
      const workflow = await read('.github/workflows/verify.yml');
      expect(workflow).toContain('E2E_SHARD: ${{ matrix.shard }}');
      expect(await read('apps/admin-console/e2e/run.sh')).toContain('--shard "$E2E_SHARD"');
    });

    it('keeps `e2e` as one job that waits for every slice and is skipped as they are', async () => {
      const workflow = await read('.github/workflows/verify.yml');
      const job = workflow.slice(workflow.indexOf('\n  e2e:\n'));
      const block = job.slice(0, job.indexOf('\n  conformance:\n'));
      expect(block).toContain('needs: [changes, e2e-shards]');
      expect(block).toMatch(/^ {4}if: always\(\) && needs\.changes\.outputs\.server == 'true'$/mu);
      expect(block).toContain('needs.e2e-shards.result');
      expect(jobNames(workflow)).toContain('e2e-shards');
    });

    it('gives each slice a runner and a report of its own', async () => {
      const workflow = await read('.github/workflows/verify.yml');
      const job = workflow.slice(workflow.indexOf('\n  e2e-shards:\n'));
      const block = job.slice(0, job.indexOf('\n  e2e:\n'));
      expect(block).toContain('runs-on: ubuntu-latest');
      expect(block).toContain('fail-fast: false');
      expect(block).toMatch(/name: playwright-report-\$\{\{ strategy\.job-index \}\}/u);
    });
  });

  describe('the image build', () => {
    it('is one action both jobs that run the image use, with one writer of the cache', async () => {
      const workflow = await read('.github/workflows/verify.yml');
      const uses = workflow.match(/uses: \.\/\.github\/actions\/image/gu) ?? [];
      expect(uses).toHaveLength(2);
      expect(workflow).toContain('save-cache: ${{ strategy.job-index == 0 }}');
      const action = await read('.github/actions/image/action.yml');
      expect(action).toContain('cache-from: type=gha,scope=odudu-image');
      expect(action).toContain('scope=odudu-image,mode=max');
    });

    it('tags the image with the name compose gives it in each script that starts it', async () => {
      const action = await read('.github/actions/image/action.yml');
      const run = await read('apps/admin-console/e2e/run.sh');
      const smoke = await read('infra/docker/smoke.sh');
      const e2eProject = /E2E_COMPOSE_PROJECT:-([\w-]+)/u.exec(run)?.[1];
      const smokeProject = /COMPOSE_PROJECT_NAME=([\w-]+)/u.exec(smoke)?.[1];
      expect(action).toContain(`${String(e2eProject)}-odudu\n`);
      expect(action).toContain(`${String(smokeProject)}-odudu\n`);
    });
  });
});
