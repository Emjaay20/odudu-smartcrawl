import { describe, expect, it } from 'vitest';
import { SHELL_CSP } from '../../packages/console-gateway/src/view/spa.js';
import { pageHeaders, type RenderedPage } from '../../packages/kernel/src/index.js';
import { loadDocument } from './markdown.js';

// A recorded `content-security-policy` is a claim about what the server sends.
// Each page's policy is rebuilt from what its own line says the page carries
// (a nonce, a framed origin, a redirect target) and handed to `pageHeaders`,
// so a directive added there fails every transcript that no longer shows it.
const GUIDES = ['docs/request-paths.md', 'docs/console-paths.md', 'docs/admin-paths.md'];
const RECORDED = /^(?:[<>] )?content-security-policy: (.+)$/u;

interface Recorded {
  readonly where: string;
  readonly policy: string;
}

function recorded(): Recorded[] {
  return GUIDES.flatMap((guide) =>
    loadDocument(guide).lines.flatMap((line, index) => {
      const policy = RECORDED.exec(line)?.[1];
      return policy === undefined ? [] : [{ where: `${guide}:${String(index + 1)}`, policy }];
    }),
  );
}

function sources(directives: readonly string[], name: string): string[] | undefined {
  const found = directives.find((directive) => directive.startsWith(`${name} `));
  return found?.slice(name.length + 1).split(' ');
}

function pageOf(policy: string): RenderedPage {
  const directives = policy.split('; ');
  const nonce = /^'nonce-(.+)'$/u.exec(sources(directives, 'script-src')?.[0] ?? '')?.[1];
  const formAction = sources(directives, 'form-action') ?? [];
  return {
    html: '',
    body: '',
    title: '',
    script:
      nonce === undefined
        ? null
        : { nonce, fetchesSameOrigin: sources(directives, 'connect-src') !== undefined },
    frames: sources(directives, 'frame-src') ?? [],
    ...(formAction[1] === undefined ? {} : { redirectsTo: formAction[1] }),
  };
}

function policyOf(page: RenderedPage): string {
  return pageHeaders(page).find(([name]) => name === 'content-security-policy')?.[1] ?? '';
}

describe('the content-security-policy lines the guides record', () => {
  const lines = recorded();

  it('finds a recorded policy in each guide, so an empty scan cannot pass', () => {
    for (const guide of GUIDES) {
      expect(
        lines.some((line) => line.where.startsWith(`${guide}:`)),
        guide,
      ).toBe(true);
    }
  });

  it('shows every page policy as pageHeaders sends it', () => {
    const pages = lines.filter((line) => line.policy.startsWith("default-src 'none'"));
    expect(pages.length).toBeGreaterThan(10);
    const drift = pages
      .filter((line) => policyOf(pageOf(line.policy)) !== line.policy)
      .map((line) => `${line.where}: ${line.policy}\n  expected ${policyOf(pageOf(line.policy))}`);
    expect(drift).toEqual([]);
  });

  it('shows the console shell policy as the gateway sends it', () => {
    const shell = lines.filter((line) => line.policy.startsWith("default-src 'self'"));
    expect(shell.length).toBeGreaterThan(0);
    expect(shell.filter((line) => line.policy !== SHELL_CSP).map((line) => line.where)).toEqual([]);
  });

  it('records no policy of a third shape', () => {
    const other = lines.filter(
      (line) =>
        !line.policy.startsWith("default-src 'none'") &&
        !line.policy.startsWith("default-src 'self'"),
    );
    expect(other.map((line) => line.where)).toEqual([]);
  });
});
