import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DOCS_ROOT } from '#docs/tests/support/dist.ts';

const REPO = path.resolve(DOCS_ROOT, '../..');
const CONTENT = path.join(DOCS_ROOT, 'content/en');
const page = (relative: string): string => readFileSync(path.join(CONTENT, relative), 'utf8');
const repoFile = (relative: string): string => readFileSync(path.join(REPO, relative), 'utf8');

const OPERATING = [
  'deploying',
  'configuration',
  'upgrading',
  'backups',
  'scaling',
  'hardening',
  'releasing',
];

// The variables each exported guard in config-guard.ts reads or names: the
// page has to name every one of them, so a guard added there fails here
// until the pages say what it refuses.
function guards(): Map<string, string[]> {
  const source = repoFile('apps/server/src/config-guard.ts');
  const found = new Map<string, string[]>();
  const starts = [...source.matchAll(/^export function (assert\w+)\(/gmu)];
  starts.forEach((match, index) => {
    const end = starts[index + 1]?.index ?? source.length;
    const body = source.slice(match.index, end);
    found.set(match[1] ?? '', [...new Set(body.match(/ODUDU_[A-Z0-9_]+/gu) ?? [])].sort());
  });
  return found;
}

describe('the guards the server boots under', () => {
  it('finds the guards in config-guard.ts', () => {
    expect([...guards().keys()]).toContain('assertProductionTls');
    expect(guards().size).toBeGreaterThanOrEqual(6);
  });

  it.each(['operating/configuration.md', 'operating/hardening.md'])(
    '%s names every variable a guard reads, with the guard it belongs to',
    (file) => {
      const text = page(file);
      for (const [guard, variables] of guards()) {
        for (const variable of variables) {
          expect(text, `${guard}: ${variable}`).toContain(variable);
        }
      }
    },
  );

  it('hardening.md lists one checklist item for each guard', () => {
    const items = page('operating/hardening.md').match(/^- \[ \] /gmu) ?? [];
    expect(items.length).toBeGreaterThanOrEqual(guards().size);
  });
});

describe('the operating section', () => {
  it('has the pages and links each from its index', () => {
    const index = page('operating/index.md');
    for (const name of OPERATING) {
      expect(existsSync(path.join(CONTENT, `operating/${name}.md`)), name).toBe(true);
      expect(index, name).toContain(`](./${name}.md)`);
    }
  });

  it('links the configuration page to the generated reference', () => {
    expect(page('operating/configuration.md')).toContain(
      '](../reference/generated/configuration.md',
    );
  });

  it('says on deploying.md where the image is, what Postgres it needs and what the proxy must do', () => {
    const text = page('operating/deploying.md');
    for (const term of [
      'ghcr.io/wizzywit/odudu',
      'PostgreSQL 17',
      'ODUDU_DATABASE_URL',
      'ODUDU_APP_DATABASE_URL',
      'ODUDU_TRUST_PROXY',
      'ODUDU_TLS_CLIENT_CERT_HEADER',
      'client_max_body_size 16m',
    ]) {
      expect(text, term).toContain(term);
    }
    expect(text).toMatch(/must strip this header/u);
    expect(text).toMatch(/under a path prefix is not\s+supported/u);
    expect(text).toContain('root of the address `ODUDU_PUBLIC_BASE_URL` names');
  });

  it('shows the cosign commands of RELEASING.md once it exists, copied, not retyped', () => {
    if (!existsSync(path.join(REPO, 'RELEASING.md'))) {
      expect(page('operating/deploying.md')).not.toContain('cosign verify');
      return;
    }
    const lines = repoFile('RELEASING.md')
      .split('\n')
      .filter((line) => line.startsWith('cosign verify'));
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(page('operating/deploying.md')).toContain(line);
  });

  it('says on upgrading.md that migrations run at boot, that there is no rolling upgrade and to take a backup first', () => {
    const text = page('operating/upgrading.md');
    expect(text).toMatch(/migrations .*(at start|at boot)/iu);
    expect(text).toMatch(/no rolling upgrade/iu);
    expect(text).toContain('](./backups.md');
    expect(text).toContain('](../roadmap.md');
  });

  it('says on backups.md that pg_dump is the mechanism and the key must be kept apart', () => {
    const text = page('operating/backups.md');
    expect(text).toContain('pg_dump');
    expect(text).toContain('ODUDU_KEK');
    expect(text).toContain('](../roadmap.md');
  });

  it('says on scaling.md that one instance runs today and where many are placed', () => {
    const text = page('operating/scaling.md');
    expect(text).toMatch(/one instance/iu);
    expect(text).toContain('](../roadmap.md');
  });

  it('keeps the runnable commands of the operating pages to one command line each', () => {
    for (const name of OPERATING) {
      const text = page(`operating/${name}.md`);
      for (const block of text.matchAll(/^```sh \{run[^}]*\}\n([\s\S]*?)\n```$/gmu)) {
        const command = block[1] ?? '';
        expect(command.split('\n').length, `${name}: ${command}`).toBe(1);
      }
    }
  });
});

describe('the security section', () => {
  const ADR_LINK = /docs\/adr\/(\d{4}-[a-z0-9-]+\.md)/gu;

  it('has the threat model and the disclosure page, linked from its index', () => {
    const index = page('security/index.md');
    for (const name of ['threat-model', 'disclosure']) {
      expect(existsSync(path.join(CONTENT, `security/${name}.md`)), name).toBe(true);
      expect(index, name).toContain(`](./${name}.md)`);
    }
  });

  it('cites only decision records that exist', () => {
    const adrs = readdirSync(path.join(REPO, 'docs/adr'));
    const cited = [...page('security/threat-model.md').matchAll(ADR_LINK)].map((m) => m[1] ?? '');
    expect(cited.length).toBeGreaterThan(5);
    expect(cited.filter((name) => !adrs.includes(name))).toEqual([]);
  });

  it('says plainly that no outside review has been done, as SECURITY.md does', () => {
    expect(page('security/threat-model.md')).toMatch(/not been (security )?reviewed/u);
    expect(repoFile('SECURITY.md')).toMatch(/not been security reviewed/u);
  });

  it('gives the reporting address SECURITY.md gives', () => {
    const advisory = /https:\/\/github\.com\/[\w-]+\/odudu\/security\/advisories\/new/u;
    const given = advisory.exec(repoFile('SECURITY.md'))?.[0] ?? '';
    expect(given).not.toBe('');
    expect(page('security/disclosure.md')).toContain(given);
  });
});

describe('the contributing section', () => {
  const MAP = ['apps', 'packages', 'tools'];

  it('has its pages, linked from its index', () => {
    const index = page('contributing/index.md');
    for (const name of ['architecture', 'running-the-tests', 'the-phase-process']) {
      expect(existsSync(path.join(CONTENT, `contributing/${name}.md`)), name).toBe(true);
      expect(index, name).toContain(`](./${name}.md)`);
    }
  });

  it('names every workspace directory on the architecture page', () => {
    const text = page('contributing/architecture.md');
    for (const group of MAP) {
      for (const entry of readdirSync(path.join(REPO, group), { withFileTypes: true })) {
        if (entry.isDirectory() && entry.name !== 'node_modules') {
          expect(text, `${group}/${entry.name}`).toContain(`\`${group}/${entry.name}\``);
        }
      }
    }
  });

  it('gives the five layers of the layering table', () => {
    const text = page('contributing/architecture.md');
    for (const layer of ['view', 'usecase', 'repository', 'adapter', 'service']) {
      expect(text, layer).toMatch(new RegExp(`\\| ${layer} +\\|`, 'u'));
    }
  });

  it('names the root scripts the tests page tells a contributor to run', () => {
    const manifest = JSON.parse(repoFile('package.json')) as { scripts: Record<string, string> };
    const named = [
      ...page('contributing/running-the-tests.md').matchAll(/`pnpm ([a-z][a-z:-]*)/gu),
    ].map((m) => m[1] ?? '');
    expect(named.length).toBeGreaterThan(5);
    expect(named.filter((s) => !(s in manifest.scripts) && s !== 'install')).toEqual([]);
  });

  it('summarises the phase sequence in order', () => {
    const text = page('contributing/the-phase-process.md').toLowerCase();
    const order = ['1. **brainstorm', '2. **write the plan', '3. **execute', '4. **finish'].map(
      (step) => text.indexOf(step),
    );
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});
