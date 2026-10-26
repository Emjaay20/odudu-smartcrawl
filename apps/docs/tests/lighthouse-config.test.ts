import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DOCS_DIRECTORY, PAGES_BASE } from '#docs/site.config.ts';
import { DOCS_ROOT, distDir } from '#docs/tests/support/dist.ts';

const PORT = 4291;
const ORIGIN = `http://127.0.0.1:${String(PORT)}`;
const WORKFLOW = path.join(DOCS_ROOT, '../../.github/workflows/verify.yml');

type Assertion = [
  string,
  { minScore?: number; maxNumericValue?: number; aggregationMethod?: string },
];

interface Config {
  ci: {
    collect: {
      url: string[];
      numberOfRuns: number;
      startServerCommand: string;
      startServerReadyPattern: string;
      settings: {
        formFactor: string;
        throttlingMethod: string;
        throttling: Record<string, number>;
      };
    };
    assert: { assertions: Record<string, Assertion> };
    upload: { target: string; outputDir: string };
  };
}

const config = JSON.parse(
  readFileSync(path.join(DOCS_ROOT, 'lighthouserc.json'), 'utf8'),
) as Config;
const { collect, assert } = config.ci;

// The page paths are the sample: the landing, the first page a newcomer opens,
// a guide, the heaviest generated reference page and a concept page.
const PAGES = [
  '',
  `${DOCS_DIRECTORY}quick-start/`,
  `${DOCS_DIRECTORY}guides/sign-a-user-in/`,
  `${DOCS_DIRECTORY}reference/generated/admin-api/subjects/`,
  `${DOCS_DIRECTORY}concepts/tokens/`,
];

const BOUNDS: Record<string, Assertion[1]> = {
  'largest-contentful-paint': { maxNumericValue: 2500 },
  'cumulative-layout-shift': { maxNumericValue: 0.1 },
  'total-blocking-time': { maxNumericValue: 350 },
  'categories:performance': { minScore: 0.9 },
  'categories:accessibility': { minScore: 0.95 },
  'categories:best-practices': { minScore: 0.95 },
  'categories:seo': { minScore: 1 },
};

describe('the Lighthouse budgets', () => {
  it('measure the landing page and four documentation pages under the site base', () => {
    expect(collect.url).toEqual(PAGES.map((page) => `${ORIGIN}${PAGES_BASE}${page}`));
  });

  it('name pages the Pages build has', () => {
    const dir = distDir('pages');
    const missing = PAGES.filter((page) => !existsSync(path.join(dir, page, 'index.html')));
    expect(missing).toEqual([]);
  });

  it('assert exactly these bounds, each an error on the median of the runs', () => {
    const entries = Object.entries(assert.assertions);
    expect(entries.map(([name]) => name).sort()).toEqual(Object.keys(BOUNDS).sort());
    for (const [name, [level, options]] of entries) {
      expect(level, name).toBe('error');
      expect(options, name).toEqual({ ...BOUNDS[name], aggregationMethod: 'median' });
    }
  });

  it('does not assert the script byte size, which the landing browser test measures', () => {
    expect(Object.keys(assert.assertions)).not.toContain('resource-summary:script:size');
  });

  it('runs three times on the throttled mobile profile', () => {
    expect(collect.numberOfRuns).toBe(3);
    expect(collect.settings).toEqual({
      chromeFlags: '--no-sandbox --headless=new',
      formFactor: 'mobile',
      throttlingMethod: 'devtools',
      throttling: { rttMs: 150, throughputKbps: 1638.4, cpuSlowdownMultiplier: 4 },
    });
  });

  it('serves the build with the compressing server, started directly so lhci can stop it', () => {
    expect(collect.startServerCommand).toBe(
      `node scripts/serve.mjs dist/pages --base ${PAGES_BASE} --port ${String(PORT)}`,
    );
    expect(collect.startServerReadyPattern).toBe('Serving');
  });

  it('keeps the reports as files for the job to upload', () => {
    expect(config.ci.upload).toEqual({ target: 'filesystem', outputDir: '.lighthouseci' });
  });
});

describe('the lighthouse job', () => {
  const workflow = readFileSync(WORKFLOW, 'utf8');
  const job = /\n {2}lighthouse:\n([\s\S]*?)(?=\n {2}[a-z][\w-]*:\n)/u.exec(workflow)?.[1] ?? '';

  it('exists, runs for a change the site can feel, and is bounded to twenty minutes', () => {
    expect(job).not.toBe('');
    expect(job).toMatch(/needs: changes/u);
    expect(job).toMatch(/if: needs\.changes\.outputs\.buildImage == 'true'/u);
    expect(job).toMatch(/timeout-minutes: 20\b/u);
    expect(job).toMatch(/timeout-minutes: 12\b/u);
  });

  it('builds the Pages target and runs lhci from the docs package', () => {
    expect(job).toContain('build:pages');
    expect(job).toMatch(/working-directory: apps\/docs/u);
    expect(job).toMatch(/lhci collect\n\s+pnpm exec lhci assert/u);
  });

  it('keeps the reports for two weeks, and even a red run uploads them', () => {
    expect(job).toMatch(/uses: actions\/upload-artifact@[0-9a-f]{40} # v7\.\d+\.\d+/u);
    expect(job).toMatch(/if: always\(\)/u);
    expect(job).toMatch(/path: apps\/docs\/\.lighthouseci/u);
    expect(job).toMatch(/include-hidden-files: true/u);
    expect(job).toMatch(/retention-days: 14/u);
  });

  it('is waited for by the gate', () => {
    const gate = workflow.slice(workflow.indexOf('\n  gate:\n'));
    expect(gate).toMatch(/^ {6}- lighthouse$/mu);
  });
});
