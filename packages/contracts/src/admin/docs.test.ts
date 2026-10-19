import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { clientSchema, listClientsQuerySchema } from '#/admin/clients';
import { documentedJsonSchema } from '#/admin/docs';
import { createTenantRequestSchema } from '#/admin/tenants';

function property(schema: z.ZodType, name: string): { description?: string } {
  const json = documentedJsonSchema(schema);
  const found = (json.properties as Record<string, { description?: string }> | undefined)?.[name];
  if (found === undefined) throw new Error(`no property ${name}`);
  return found;
}

describe('documentedJsonSchema', () => {
  it('describes a field of an extended shape with the words of the shape it extends', () => {
    expect(property(clientSchema, 'enabled').description).toMatch(/disabled client/u);
    expect(property(clientSchema, 'service_account_admin_reach')).toBeDefined();
  });

  it('describes the paging parameters of any list query', () => {
    expect(property(listClientsQuerySchema, 'cursor').description).toMatch(/next/u);
    expect(property(listClientsQuerySchema, 'type').description).toMatch(/type/u);
  });

  it('does not let a short shape describe a long one that merely holds its fields', () => {
    const wide = z.object({
      cursor: z.string(),
      limit: z.number(),
      client: z.string(),
      a: z.string(),
      b: z.string(),
    });
    expect(property(wide, 'client').description).toBeUndefined();
  });

  it('adds the examples written for a request', () => {
    expect(documentedJsonSchema(createTenantRequestSchema).examples).toEqual([
      { name: 'acme', display_name: 'Acme Corporation' },
    ]);
  });

  it('leaves the schemas the console imports without any of this prose', () => {
    expect(JSON.stringify(z.toJSONSchema(clientSchema, { unrepresentable: 'any' }))).not.toMatch(
      /disabled client/u,
    );
  });
});
