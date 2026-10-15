import { describe, expect, it } from 'vitest';
import { isStatementTimeout } from '#/service/statement-timeout';

describe('isStatementTimeout', () => {
  it('is Postgres cancelling a statement, however deep the driver wrapped it', () => {
    expect(isStatementTimeout({ code: '57014' })).toBe(true);
    expect(isStatementTimeout(new Error('query failed', { cause: { code: '57014' } }))).toBe(true);
    expect(
      isStatementTimeout(new Error('a', { cause: new Error('b', { cause: { code: '57014' } }) })),
    ).toBe(true);
  });

  it('is no other error', () => {
    expect(isStatementTimeout({ code: '22008' })).toBe(false);
    expect(isStatementTimeout(new Error('57014'))).toBe(false);
    expect(isStatementTimeout(null)).toBe(false);
    expect(isStatementTimeout('57014')).toBe(false);
  });
});
