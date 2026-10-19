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
  // The other header lines of the block the policy sits in, prefix
  // (`< `, `> `) removed.
  readonly following: readonly string[];
}

function recorded(): Recorded[] {
  return GUIDES.flatMap((guide) =>
    loadDocument(guide).lines.flatMap((line, index, all) => {
      const policy = RECORDED.exec(line)?.[1];
      if (policy === undefined) return [];
      const isHeader = (text: string | undefined): text is string =>
        text !== undefined && /^[a-z][a-z-]*: /u.test(text.replace(/^[<>] /u, ''));
      const around: string[] = [];
      for (let at = index - 1; isHeader(all[at]); at--) around.unshift(all[at] ?? '');
      for (let at = index + 1; isHeader(all[at]); at++) around.push(all[at] ?? '');
      const following = around.map((next) => next.replace(/^[<>] /u, ''));
      return [{ where: `${guide}:${String(index + 1)}`, policy, following }];
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

function otherHeaders(page: RenderedPage): string[] {
  return pageHeaders(page)
    .filter(([name]) => name !== 'content-security-policy')
    .map(([name, value]) => `${name}: ${value}`);
}

// A script's nonce is 16 random bytes, base64 with padding.
const NONCE = /^'nonce-[A-Za-z0-9+/]{22}=='$/u;
const ORIGIN = /^https?:\/\/[a-z0-9.-]+(?::\d{1,5})?$/u;

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

  it('shows the headers that ride beside a page policy as pageHeaders sends them', () => {
    const pages = lines.filter((line) => line.policy.startsWith("default-src 'none'"));
    const whole = pages.filter((line) => line.following.includes('x-frame-options: DENY'));
    expect(whole.length).toBeGreaterThan(10);
    const drift = whole.flatMap((line) =>
      otherHeaders(pageOf(line.policy))
        .filter((header) => !line.following.includes(header))
        .map((header) => `${line.where}: missing ${header}`),
    );
    expect(drift).toEqual([]);
  });

  it('shows the console shell forbidding a sniffed type, where it records its headers whole', () => {
    const shell = lines.filter(
      (line) =>
        line.policy.startsWith("default-src 'self'") &&
        line.following.includes('x-frame-options: DENY'),
    );
    expect(shell.length).toBeGreaterThan(0);
    expect(
      shell
        .filter((line) => !line.following.includes('x-content-type-options: nosniff'))
        .map((line) => line.where),
    ).toEqual([]);
  });

  it('records a script only as one nonce, with connect-src alone beside it', () => {
    const pages = lines.filter((line) => line.policy.startsWith("default-src 'none'"));
    const scripted = pages.filter((line) => line.policy.includes('script-src'));
    expect(scripted.length).toBeGreaterThan(0);
    const bad = pages.flatMap((line) => {
      const directives = line.policy.split('; ');
      const script = sources(directives, 'script-src');
      const connect = sources(directives, 'connect-src');
      const ok =
        script === undefined
          ? connect === undefined
          : script.length === 1 &&
            NONCE.test(script[0] ?? '') &&
            (connect === undefined || (connect.length === 1 && connect[0] === "'self'"));
      return ok ? [] : [line.where];
    });
    expect(bad).toEqual([]);
  });

  it('records frame-src only as a list of bare origins', () => {
    const framed = lines.filter((line) => line.policy.includes('frame-src '));
    expect(framed.length).toBeGreaterThan(0);
    const bad = framed
      .filter((line) =>
        (sources(line.policy.split('; '), 'frame-src') ?? []).some((o) => !ORIGIN.test(o)),
      )
      .map((line) => line.where);
    expect(bad).toEqual([]);
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
