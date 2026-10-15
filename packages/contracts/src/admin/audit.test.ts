import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { listAuditQuerySchema } from '#/admin/audit';

function parsed(query: Record<string, string>) {
  return listAuditQuerySchema.safeParse(query);
}

describe('the instants an audit listing takes', () => {
  it('takes a time from 1970 to 9999, in any offset the ISO form allows', () => {
    expect(parsed({ from: '1970-01-01T00:00:00Z' }).success).toBe(true);
    expect(parsed({ to: '2026-09-28T10:00:00.250+01:00' }).success).toBe(true);
    expect(parsed({ to: '9999-12-31T23:59:59Z' }).success).toBe(true);
  });

  it('refuses a year Postgres would reject or JavaScript cannot write back', () => {
    for (const value of [
      '0000-01-01T00:00:00Z',
      '0001-01-01T00:00:00+14:00',
      '1969-12-31T23:59:59Z',
      '9999-12-31T23:59:59-14:00',
    ]) {
      const result = parsed({ from: value });
      expect(result.success, value).toBe(false);
    }
    expect(parsed({ to: '0000-01-01T00:00:00Z' }).error?.issues[0]?.message).toBe(
      'must be an instant from 1970 to 9999',
    );
  });

  it('holds the same bound in the JSON Schema the route validates with', () => {
    const json = z.toJSONSchema(listAuditQuerySchema, { io: 'input' });
    const patterns = JSON.stringify(json);
    expect(patterns).toContain('19[7-9]');
  });
});
