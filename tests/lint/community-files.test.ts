import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { MAX_BODY_WEIGHT, MAX_SUBJECT_LENGTH } from '../../tools/commit-message/src/check.ts';
import { REPO_ROOT } from '../docs/markdown.js';
import { siteConstants } from '../docs/site-constants.js';

const {
  OWNER_NOTICE,
  OWNER_NOTICE_NAME,
  PAGES_DOCS_BASE,
  REPOSITORY_URL,
  SITE_ORIGIN,
  TRADEMARK_URL,
} = await siteConstants();

const read = (file: string): string => readFileSync(path.join(REPO_ROOT, file), 'utf8');
const ADVISORY = `${REPOSITORY_URL}/security/advisories/new`;

describe('the community files exist and say what the repository does', () => {
  it.each([
    'SECURITY.md',
    'CONTRIBUTING.md',
    'CODE_OF_CONDUCT.md',
    'TRADEMARK.md',
    'brand/NOTICE.md',
    '.github/PULL_REQUEST_TEMPLATE.md',
    '.github/ISSUE_TEMPLATE/bug_report.yml',
    '.github/ISSUE_TEMPLATE/feature_request.yml',
    '.github/ISSUE_TEMPLATE/config.yml',
  ])('has %s', (file) => {
    expect(existsSync(path.join(REPO_ROOT, file)), file).toBe(true);
  });
});

describe('SECURITY.md', () => {
  const security = read('SECURITY.md');

  it('sends a reporter to private reporting first, and names the supported versions', () => {
    expect(security).toContain(ADVISORY);
    expect(security).toMatch(/latest release/iu);
    expect(security).toMatch(/before 1\.0/iu);
  });

  it('does not repeat the README notice that it has not been security reviewed', () => {
    expect(security).not.toMatch(/has not been security reviewed|should not be deployed/iu);
  });
});

describe('CONTRIBUTING.md', () => {
  // Prettier wraps prose, so a phrase is looked for as a reader sees it.
  const contributing = read('CONTRIBUTING.md').replaceAll(/\s+/gu, ' ');

  it('points at the licence table, the contributor agreement and the process pages', () => {
    expect(contributing).toContain('LICENSING.md');
    expect(contributing).toMatch(/contributor licence agreement/iu);
    expect(contributing).toContain('0042');
    expect(contributing).toContain('CODE_OF_CONDUCT.md');
    expect(contributing).toMatch(/docs\/contributing\//u);
  });

  it('says how to run the gate and the tests', () => {
    expect(contributing).toContain('pnpm verify');
    expect(contributing).toContain('pnpm test');
    expect(contributing).toContain('git config core.hooksPath .githooks');
  });

  it('states the commit-message rules the checker enforces, and bans attribution', () => {
    expect(contributing).toContain(`${String(MAX_SUBJECT_LENGTH)} characters`);
    expect(contributing).toContain(`${String(MAX_BODY_WEIGHT)} lines`);
    expect(contributing).toMatch(/no (tool )?attribution/iu);
  });

  it('says how to start the quick start from a checkout, and what a good bug report holds', () => {
    expect(contributing).toContain('infra/docker');
    expect(contributing).toContain('odudu --version');
    expect(contributing).toContain('docker compose logs odudu');
    expect(contributing).toMatch(/redact/iu);
    expect(contributing).toMatch(/digest/iu);
  });

  it('links only to pages of the site that exist', () => {
    const site = `${SITE_ORIGIN}${PAGES_DOCS_BASE}`;
    const found = [...contributing.matchAll(/\]\((https:\/\/[^)\s]+)\)/gu)]
      .map((match) => match[1] ?? '')
      .filter((url) => url.startsWith(site));
    expect(found.length).toBeGreaterThan(2);
    for (const url of found) {
      const route = url.slice(site.length).replace(/\/$/u, '');
      const base = path.join(REPO_ROOT, 'apps/docs/content/en', route);
      expect(
        ['.md', '.mdx', '/index.md', '/index.mdx'].some((tail) => existsSync(`${base}${tail}`)),
        url,
      ).toBe(true);
    }
  });

  it('links only to files and addresses that exist', () => {
    for (const [, target] of contributing.matchAll(/\]\(([^)\s#]+)(?:#[^)]*)?\)/gu)) {
      if (target === undefined || /^[a-z][a-z0-9+.-]*:/iu.test(target)) continue;
      expect(existsSync(path.join(REPO_ROOT, target)), target).toBe(true);
    }
  });
});

describe('CODE_OF_CONDUCT.md', () => {
  const conduct = read('CODE_OF_CONDUCT.md');

  it('is the Contributor Covenant 2.1, with a contact filled in', () => {
    expect(conduct.split('\n')[0]).toBe('# Contributor Covenant Code of Conduct');
    expect(conduct).toContain('version 2.1');
    expect(conduct).not.toContain('[INSERT CONTACT METHOD]');
  });

  it('gives the contact SECURITY.md gives', () => {
    const address = /[\w.+-]+@[\w-]+\.[\w.]+/u.exec(read('SECURITY.md'))?.[0];
    expect(address).toBeDefined();
    expect(conduct).toContain(address ?? '');
  });
});

describe('the issue forms', () => {
  const form = (file: string): Record<string, unknown> => {
    const parsed: unknown = parse(read(`.github/ISSUE_TEMPLATE/${file}`));
    if (typeof parsed !== 'object' || parsed === null) throw new Error(`${file} is not a mapping`);
    return parsed as Record<string, unknown>;
  };
  const fields = (file: string): { id?: string; validations?: { required?: boolean } }[] => {
    const body = form(file).body;
    if (!Array.isArray(body)) throw new Error(`${file} has no body list`);
    return body as { id?: string; validations?: { required?: boolean } }[];
  };

  it.each(['bug_report.yml', 'feature_request.yml'])(
    '%s is a form with a name and a body',
    (file) => {
      expect(typeof form(file).name).toBe('string');
      expect(typeof form(file).description).toBe('string');
      expect(fields(file).length).toBeGreaterThan(1);
    },
  );

  it('asks the bug reporter for a version, and requires it', () => {
    const version = fields('bug_report.yml').find((field) => field.id === 'version');
    expect(version?.validations?.required).toBe(true);
  });

  it('asks for the digest and a redacted log tail', () => {
    const text = read('.github/ISSUE_TEMPLATE/bug_report.yml');
    expect(text).toMatch(/digest/iu);
    expect(text).toContain('docker compose logs odudu');
    expect(text).toMatch(/redact/iu);
  });

  it('turns blank issues off and sends vulnerabilities to private reporting', () => {
    const config = form('config.yml');
    expect(config.blank_issues_enabled).toBe(false);
    const links = config.contact_links;
    expect(Array.isArray(links)).toBe(true);
    expect(JSON.stringify(links)).toContain(ADVISORY);
  });
});

describe('the pull request template', () => {
  const template = read('.github/PULL_REQUEST_TEMPLATE.md');

  it('mirrors the finishing bar', () => {
    expect(template).toMatch(/CI is green/iu);
    expect(template).toMatch(/documentation|docs/iu);
    expect(template).toMatch(/tests? (came|written|first)/iu);
    expect(template).toMatch(/no `any`/iu);
    expect(template).toMatch(/no (tool )?attribution/iu);
  });

  it('carries no attribution line itself', () => {
    expect(template).not.toMatch(/Co-Authored-By:|Generated with/u);
  });
});

describe('the name and the mark', () => {
  const holders = ['README.md', 'TRADEMARK.md', 'brand/NOTICE.md'];

  it('are claimed in one sentence, from one constant, in every place that claims them', () => {
    expect(OWNER_NOTICE).toContain(OWNER_NOTICE_NAME);
    for (const file of holders) expect(read(file), file).toContain(OWNER_NOTICE);
  });

  it('links the policy from the README, the brand notice and the decision record', () => {
    expect(read('README.md')).toContain('(TRADEMARK.md)');
    expect(read('brand/NOTICE.md')).toContain('(../TRADEMARK.md)');
    expect(read('docs/adr/0042-distribution-licensing-and-the-paid-boundary.md')).toContain(
      'TRADEMARK.md',
    );
    expect(TRADEMARK_URL).toBe(`${REPOSITORY_URL}/blob/main/TRADEMARK.md`);
  });

  it('says what anyone may do, what needs permission, and that nothing is endorsed', () => {
    const policy = read('TRADEMARK.md');
    expect(policy).toMatch(/works with Odudu/u);
    expect(policy).toMatch(/permission/iu);
    expect(policy).toMatch(/endorse/iu);
    expect(policy).toMatch(/fork/iu);
    expect(policy).toMatch(/™/u);
  });

  it('uses no registered symbol, because nothing is registered', () => {
    for (const file of [
      ...holders,
      'SECURITY.md',
      'CONTRIBUTING.md',
      'brand/README.md',
      'LICENSING.md',
    ]) {
      expect(read(file), file).not.toContain('®');
    }
  });

  it('keeps the brand notice free of the phrase it replaced', () => {
    expect(read('brand/NOTICE.md')).not.toMatch(/not licensed/iu);
    expect(read('brand/README.md')).not.toMatch(/not licensed/iu);
  });

  it('keeps the name origin out of public files', () => {
    for (const file of [...holders, 'CONTRIBUTING.md', 'CODE_OF_CONDUCT.md']) {
      expect(read(file), file).not.toMatch(/Ibibio|Akwa Ibom|coined/iu);
    }
  });
});
