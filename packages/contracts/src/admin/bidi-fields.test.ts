import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { BIDI_REFUSED_MESSAGE } from '#/bidi';
import { amendProfileRequestSchema } from '#/admin/profile';
import { createGroupRequestSchema } from '#/admin/groups';
import { createRoleRequestSchema } from '#/admin/roles';
import { amendSubjectRequestSchema, createSubjectRequestSchema } from '#/admin/subjects';
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
    ['renamed username', amendSubjectRequestSchema, { username: `ada${RLO}` }, 'username'],
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
    ...(
      [
        'name',
        'given_name',
        'family_name',
        'middle_name',
        'nickname',
        'preferred_username',
      ] as const
    ).map((field): [string, z.ZodType, Record<string, unknown>, string] => [
      `profile ${field}`,
      amendProfileRequestSchema,
      { [field]: `x${RLO}` },
      field,
    ]),
  ];

  it.each(cases)('%s', (_label, schema, value, path) => {
    expect(refusal(schema, value)).toEqual([{ path, message: BIDI_REFUSED_MESSAGE }]);
  });

  it('refuses it in the same place when the field is a member of the JSON Schema the API compiles', () => {
    const emitted = z.toJSONSchema(createSubjectRequestSchema);
    expect(JSON.stringify(emitted)).toContain('\\\\u202A-\\\\u202E');
  });

  it('accepts a null profile name and one with plain right-to-left text and its marks', () => {
    expect(amendProfileRequestSchema.safeParse({ given_name: null }).success).toBe(true);
    expect(
      amendProfileRequestSchema.safeParse({ given_name: 'שלום', family_name: 'س\u200Fل\u061C' })
        .success,
    ).toBe(true);
    expect(createSubjectRequestSchema.safeParse({ username: 'مستخدم' }).success).toBe(true);
    expect(
      createTenantRequestSchema.safeParse({ name: 'acme', display_name: 'شركة' }).success,
    ).toBe(true);
  });

  it('still refuses a NUL in a profile name, as before', () => {
    expect(refusal(amendProfileRequestSchema, { given_name: 'a\u0000b' })).toHaveLength(1);
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
      clients: [{ client_id: 'c', name: `C${RLO}` }],
      roles: [{ name: `R${RLO}` }],
      groups: [{ path: `/G${RLO}` }],
      subjects: [{ username: `u${RLO}`, profile: { given_name: `g${RLO}` } }],
    }).filter((issue) => issue.message === BIDI_REFUSED_MESSAGE);
    expect(issues.map((issue) => issue.path).sort()).toEqual([
      'clients.0.name',
      'groups.0.path',
      'roles.0.name',
      'settings.display_name',
      'subjects.0.profile.given_name',
      'subjects.0.username',
    ]);
  });
});
