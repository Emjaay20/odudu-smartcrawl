import { describe, expect, it } from 'vitest';
import { countAuditQuerySchema, exportAuditQuerySchema, listAuditQuerySchema } from '#/admin/audit';

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
      'to must be a date between 1970 and 9999',
    );
  });

  it('names the field in the message, for each of the three queries', () => {
    expect(parsed({ from: '0000-01-01T00:00:00Z' }).error?.issues[0]).toMatchObject({
      message: 'from must be a date between 1970 and 9999',
      path: ['from'],
    });
    for (const schema of [countAuditQuerySchema, exportAuditQuerySchema]) {
      expect(schema.safeParse({ to: '0000-01-01T00:00:00Z' }).error?.issues[0]).toMatchObject({
        message: 'to must be a date between 1970 and 9999',
        path: ['to'],
      });
    }
  });
});
