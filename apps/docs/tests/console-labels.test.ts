import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DOCS_ROOT } from '#docs/tests/support/dist.ts';

const REPO = path.resolve(DOCS_ROOT, '../..');
const PAGE = path.join(DOCS_ROOT, 'content/en/quick-start/index.mdx');
const CONSOLE = 'apps/admin-console/src/features';

// Where each bold name on the page is defined: the one file that renders that
// control, and the text there that gives the name. A name built from a
// template (`Create ${noun}`) lists the template and the file that binds each
// part, and the test expands it. A name the page quotes that is not in this
// table fails, so a new quotation is a new row, read against its screen.
interface Evidence {
  readonly file: string;
  readonly text: string;
}
interface Defined {
  readonly evidence: readonly Evidence[];
  // For a template: the values its parts take, which must expand to the name.
  readonly expand?: {
    readonly template: string;
    readonly values: Readonly<Record<string, string>>;
  };
}

const literal = (file: string, text: string): Defined => ({ evidence: [{ file, text }] });

const DEFINED: Readonly<Record<string, Defined>> = {
  'Continue to sign-in': literal(
    `${CONSOLE}/session/service/labels.ts`,
    "return 'Continue to sign-in'",
  ),
  Username: literal('packages/protocol-oidc/src/view/messages.ts', "'login.username': 'Username'"),
  Password: literal('packages/protocol-oidc/src/view/messages.ts', "'login.password': 'Password'"),
  SYSTEM: literal(`${CONSOLE}/shell/service/areas.ts`, "heading: 'System'"),
  IDENTITY: literal(`${CONSOLE}/shell/service/areas.ts`, "heading: 'Identity'"),
  APPLICATIONS: literal(`${CONSOLE}/shell/service/areas.ts`, "heading: 'Applications'"),
  Tenants: literal(`${CONSOLE}/shell/service/areas.ts`, "area('tenants', 'Tenants'"),
  Subjects: literal(`${CONSOLE}/shell/service/areas.ts`, "area('subjects', 'Subjects'"),
  Clients: literal(`${CONSOLE}/clients/service/address.ts`, "label: 'Clients'"),
  'Create a tenant': literal(
    `${CONSOLE}/tenants/view/TenantsPage/TenantsPage.tsx`,
    'Create a tenant',
  ),
  'Create a client': literal(
    `${CONSOLE}/clients/view/ClientsPage/ClientsPage.tsx`,
    'Create a client',
  ),
  'Create a subject': literal(
    `${CONSOLE}/subjects/view/SubjectsPage/SubjectsPage.tsx`,
    'Create a subject',
  ),
  Name: literal(`${CONSOLE}/tenants/view/NewTenantPage/NewTenantPage.tsx`, 'label="Name"'),
  'Client ID': literal(
    `${CONSOLE}/clients/view/NewClientPage/NewClientPage.tsx`,
    'label="Client ID"',
  ),
  Kind: literal(`${CONSOLE}/clients/view/NewClientPage/NewClientPage.tsx`, 'label="Kind"'),
  'Public application': literal(
    `${CONSOLE}/clients/service/create.ts`,
    "label: 'Public application'",
  ),
  'Redirect URIs': literal(
    `${CONSOLE}/clients/view/NewClientPage/NewClientPage.tsx`,
    'label="Redirect URIs"',
  ),
  Credentials: literal(`${CONSOLE}/subjects/service/tabs.ts`, "credentials: 'Credentials'"),
  'Issue a one-time password': literal(
    `${CONSOLE}/subjects/view/SubjectRecordPage/CredentialsTab.tsx`,
    'Issue a one-time password',
  ),
  'Issue password': literal(
    `${CONSOLE}/subjects/service/credentials.ts`,
    "confirmLabel: 'Issue password'",
  ),
  'Create tenant': literal(
    `${CONSOLE}/tenants/view/NewTenantPage/NewTenantPage.tsx`,
    "'Create tenant'",
  ),
  'Create client': {
    evidence: [
      {
        file: 'apps/admin-console/src/shared/view/CreationForm/CreationForm.tsx',
        text: '`Create ${noun}`',
      },
      { file: `${CONSOLE}/clients/view/NewClientPage/NewClientPage.tsx`, text: 'noun="client"' },
    ],
    expand: { template: 'Create ${noun}', values: { noun: 'client' } },
  },
  'Create subject': {
    evidence: [
      {
        file: 'apps/admin-console/src/shared/view/CreationForm/CreationForm.tsx',
        text: '`Create ${noun}`',
      },
      {
        file: `${CONSOLE}/subjects/view/NewSubjectPage/NewSubjectPage.tsx`,
        text: 'noun="subject"',
      },
    ],
    expand: { template: 'Create ${noun}', values: { noun: 'subject' } },
  },
  // The tenant's own name is whatever the reader chose; the page uses demo.
  'Enter demo': {
    evidence: [
      {
        file: `${CONSOLE}/tenants/view/TenantsPage/TenantsPage.tsx`,
        text: '`Enter ${tenant.name}`',
      },
    ],
    expand: { template: 'Enter ${tenant.name}', values: { 'tenant.name': 'demo' } },
  },
};

const read = (file: string): string => readFileSync(path.join(REPO, file), 'utf8');

export function expanded(template: string, values: Readonly<Record<string, string>>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`\${${key}}`, value),
    template,
  );
}

function quotedNames(): string[] {
  const prose = readFileSync(PAGE, 'utf8').replace(/^(`{3,})[\s\S]*?^\1$/gmu, '');
  return [...prose.matchAll(/\*\*([^*]+)\*\*/gu)].map((match) => match[1] ?? '');
}

describe('the names the quick start quotes from the console', () => {
  it('finds the names, so a changed quotation mark fails rather than passing vacuously', () => {
    expect(quotedNames().length).toBeGreaterThan(15);
  });

  it('are each in the table, so a new quotation is read against its screen', () => {
    expect(quotedNames().filter((name) => DEFINED[name] === undefined)).toEqual([]);
  });

  it('are each defined where the table says, by exactly that text', () => {
    const wrong: string[] = [];
    for (const [name, defined] of Object.entries(DEFINED)) {
      for (const { file, text } of defined.evidence) {
        if (!read(file).includes(text)) wrong.push(`${name}: ${file} does not hold ${text}`);
      }
      if (defined.expand !== undefined) {
        const { template, values } = defined.expand;
        if (expanded(template, values) !== name) wrong.push(`${name}: expands to something else`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('lists no name the page does not quote', () => {
    const quoted = new Set(quotedNames());
    expect(Object.keys(DEFINED).filter((name) => !quoted.has(name))).toEqual([]);
  });

  it('refuses a name no screen defines, and a control whose label was renamed', () => {
    expect(DEFINED['Create a widget']).toBeUndefined();
    const renamed = read(`${CONSOLE}/clients/view/NewClientPage/NewClientPage.tsx`).replace(
      'label="Kind"',
      'label="Type"',
    );
    expect(renamed.includes('label="Kind"')).toBe(false);
  });
});
