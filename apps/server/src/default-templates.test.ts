import { checkTemplate } from '@odudu/domain-theme';
import { PAGE_KINDS, type PageKind } from '@odudu/kernel';
import { DEFAULT_TEMPLATES as PROTOCOL_OIDC } from '@odudu/protocol-oidc';
import { describe, expect, it } from 'vitest';

interface Owner {
  name: string;
  templates: Partial<Record<PageKind, string>>;
}

// One entry per package that renders pages through a default template.
const OWNERS: Owner[] = [{ name: 'protocol-oidc', templates: PROTOCOL_OIDC }];

// Kinds whose renderers have not been converted yet; a kind leaves this list
// when its package's table joins OWNERS.
const NOT_CONVERTED: PageKind[] = [
  'totp-enrolment',
  'passkey-enrolment',
  'recovery-codes',
  'update-password',
  'required-action',
  'registration',
  'reset',
  'verification',
  'required-actions',
];

const kindsOf = (templates: Partial<Record<PageKind, string>>): PageKind[] =>
  Object.keys(templates) as PageKind[];

describe('the default templates', () => {
  it('leaves no kind without an owner or a note that it is not converted', () => {
    const owned = OWNERS.flatMap((owner) => kindsOf(owner.templates));
    expect([...owned, ...NOT_CONVERTED].sort()).toEqual(Object.keys(PAGE_KINDS).sort());
  });

  for (const { name, templates } of OWNERS) {
    describe(name, () => {
      for (const kind of kindsOf(templates)) {
        const template = templates[kind] ?? '';

        it(`passes the check a saved template passes: ${kind}`, () => {
          expect(checkTemplate(kind, template)).toEqual([]);
        });

        it(`places every required part: ${kind}`, () => {
          for (const part of PAGE_KINDS[kind].required) {
            expect(template, part).toContain(`{{${part}}}`);
          }
        });
      }
    });
  }
});

describe('a theme template that loses what the server must show', () => {
  it('is refused for a redirecting page that omits its frames and script', () => {
    const codes = checkTemplate('logged-out', '{{message}}').map((issue) => issue.detail);
    expect(codes).toEqual(expect.arrayContaining(['frames', 'script']));
  });

  it('is refused for a consent page that omits the client', () => {
    const own = '{{form.open}}{{scopes}}{{submit.allow}}{{submit.deny}}{{form.close}}';
    expect(checkTemplate('consent', own).map((issue) => issue.detail)).toContain('client');
  });

  it('is refused for a sign-in page that omits the error', () => {
    const own = '{{form.open}}{{fields}}{{submit}}{{form.close}}';
    expect(checkTemplate('sign-in', own).map((issue) => issue.detail)).toContain('error');
  });
});
