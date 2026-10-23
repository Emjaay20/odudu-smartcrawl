import { describe, expect, it } from 'vitest';
import { builtinScopeConfirmationDetail } from '#/service/scope-delete';

const none = { count: 0, capped: false };

describe('the refusal to delete a built-in scope unconfirmed', () => {
  it('names the scope, what goes with it and the confirmation that deletes it', () => {
    const detail = builtinScopeConfirmationDetail('roles', {
      builtin: true,
      client_assignments: { count: 3, capped: false },
      role_mappings: { count: 1, capped: false },
    });
    expect(detail).toBe(
      'roles is a built-in scope. Deleting it removes it from 3 clients and unmaps 1 role, ' +
        'and cannot be undone. Repeat the request with confirm=roles to delete it.',
    );
  });

  it('says nothing goes with it when nothing does, and singular for one', () => {
    expect(
      builtinScopeConfirmationDetail('email', {
        builtin: true,
        client_assignments: { count: 1, capped: false },
        role_mappings: none,
      }),
    ).toContain('removes it from 1 client and unmaps 0 roles');
  });

  it('says "or more" for a count that stopped at its cap', () => {
    expect(
      builtinScopeConfirmationDetail('email', {
        builtin: true,
        client_assignments: { count: 10_000, capped: true },
        role_mappings: none,
      }),
    ).toContain('10,000 or more clients');
  });
});
