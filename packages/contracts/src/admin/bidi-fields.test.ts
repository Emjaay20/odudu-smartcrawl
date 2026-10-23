import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { BIDI_REFUSED_MESSAGE } from '#/bidi';
import { createClientRequestSchema } from '#/admin/clients';
import { createScopeRequestSchema } from '#/admin/scopes';
import { createGroupRequestSchema } from '#/admin/groups';
import { createRoleRequestSchema } from '#/admin/roles';
import { createSubjectRequestSchema } from '#/admin/subjects';
import { importTenantRequestSchema, tenantDocumentSchema } from '#/admin/tenant-document';
import { createTenantRequestSchema } from '#/admin/tenants';

const RLO = '\u202E';

function refusal(schema: z.ZodType, value: unknown): { path: string; message: string }[] {
  const result = schema.safeParse(value);
  if (result.success) return [];
  return result.error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

describe('a typed identity or name field refuses a bidirectional control, with one message', () => {
  const cases: [string, z.ZodType, Record<string, unknown>, string][] = [
    ['subject username', createSubjectRequestSchema, { username: `ada${RLO}` }, 'username'],
    [
      'tenant display name',
      createTenantRequestSchema,
      { name: 'acme', display_name: `A${RLO}` },
      'display_name',
    ],
    [
      'imported display name',
      importTenantRequestSchema,
      { name: 'acme', display_name: `A${RLO}`, document: {} },
      'display_name',
    ],
    ['group name', createGroupRequestSchema, { name: `g${RLO}` }, 'name'],
    ['role name', createRoleRequestSchema, { name: `r${RLO}` }, 'name'],
    [
      'group description',
      createGroupRequestSchema,
      { name: 'g', description: `d${RLO}` },
      'description',
    ],
    [
      'role description',
      createRoleRequestSchema,
      { name: 'r', description: `d${RLO}` },
      'description',
    ],
    [
      'scope description',
      createScopeRequestSchema,
      { name: 's', description: `d${RLO}` },
      'description',
    ],
    [
      'scope consent text',
      createScopeRequestSchema,
      { name: 's', consent_text: `c${RLO}` },
      'consent_text',
    ],
    ['client_id', createClientRequestSchema, { client_id: `app${RLO}` }, 'client_id'],
  ];

  it.each(cases)('%s', (_label, schema, value, path) => {
    expect(refusal(schema, value)).toEqual([{ path, message: BIDI_REFUSED_MESSAGE }]);
  });

  it('refuses it in the same place when the field is a member of the JSON Schema the API compiles', () => {
    const emitted = z.toJSONSchema(createSubjectRequestSchema);
    expect(JSON.stringify(emitted)).toContain('\\\\u202A-\\\\u202E');
  });

  it('accepts plain right-to-left text and its marks', () => {
    expect(createSubjectRequestSchema.safeParse({ username: 'مستخدم' }).success).toBe(true);
    expect(
      createTenantRequestSchema.safeParse({ name: 'acme', display_name: 'شركة' }).success,
    ).toBe(true);
  });
});

describe('a tenant document refuses a bidirectional control wherever it names something', () => {
  const clean = {
    version: 1,
    settings: undefined,
  };

  it('names the field by its path in the document', () => {
    const issues = refusal(tenantDocumentSchema, {
      ...clean,
      settings: { display_name: `A${RLO}` },
      clients: [{ client_id: `c${RLO}`, name: `C${RLO}`, description: `d${RLO}` }],
      roles: [{ name: `R${RLO}`, description: `d${RLO}` }],
      scopes: [{ name: 's', description: `d${RLO}`, consent_text: `c${RLO}` }],
      groups: [{ path: `/G${RLO}`, description: `d${RLO}` }],
      subjects: [{ username: `u${RLO}`, profile: { given_name: `g${RLO}` } }],
    }).filter((issue) => issue.message === BIDI_REFUSED_MESSAGE);
    expect(issues.map((issue) => issue.path).sort()).toEqual([
      'clients.0.client_id',
      'clients.0.description',
      'clients.0.name',
      'groups.0.description',
      'groups.0.path',
      'roles.0.description',
      'roles.0.name',
      'scopes.0.consent_text',
      'scopes.0.description',
      'settings.display_name',
      'subjects.0.profile.given_name',
      'subjects.0.username',
    ]);
  });
});
