import { BIDI_REFUSED } from '@odudu/contracts';
import {
  createClientRequestSchema,
  createGroupRequestSchema,
  createRoleRequestSchema,
  createScopeRequestSchema,
  createSubjectRequestSchema,
  createTenantRequestSchema,
  importTenantRequestSchema,
} from '@odudu/contracts/admin';
import { type z } from 'zod';
import { describe, expect, it } from 'vitest';
import { compileSchema } from '#/adapter/validation';
import { validationErrors } from '#/view/problem';

const RLO = String.fromCodePoint(0x202e);

// The admin API validates a body through the JSON Schema compiled from these,
// so each refusal here is the schema layer's own, whatever the repositories
// would answer after it.
const cases: [string, z.ZodType, Record<string, unknown>, string][] = [
  ['subject username', createSubjectRequestSchema, { username: `a${RLO}` }, 'username'],
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
  ['role name', createRoleRequestSchema, { name: `r${RLO}` }, 'name'],
  [
    'role description',
    createRoleRequestSchema,
    { name: 'r', description: `d${RLO}` },
    'description',
  ],
  ['group name', createGroupRequestSchema, { name: `g${RLO}` }, 'name'],
  [
    'group description',
    createGroupRequestSchema,
    { name: 'g', description: `d${RLO}` },
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

describe('the compiled body schema refuses a bidirectional control itself', () => {
  it.each(cases)('%s', (_label, schema, body, path) => {
    const validate = compileSchema(schema, 'body');
    expect(validate(body)).toBe(false);
    const errors = validationErrors({
      message: 'body invalid',
      validation: validate.errors?.map((entry) => ({ ...entry, params: entry.params })) ?? [],
    });
    expect(errors).toEqual([expect.objectContaining({ path, code: BIDI_REFUSED })]);
  });

  it.each(cases)('%s: accepts the same body without the control', (_label, schema, body) => {
    const clean = Object.fromEntries(
      Object.entries(body).map(([key, value]) => [
        key,
        typeof value === 'string' ? value.replace(RLO, '') : value,
      ]),
    );
    expect(compileSchema(schema, 'body')(clean)).toBe(true);
  });
});
