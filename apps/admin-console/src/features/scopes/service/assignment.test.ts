import { expect, it } from 'vitest';
import {
  ASSIGNMENTS,
  assignedText,
  clientAssignmentFailure,
  clientsCount,
  unassignedText,
} from '#/features/scopes/service';

it('offers default and optional', () => {
  expect(ASSIGNMENTS.map((each) => each.id)).toEqual(['default', 'optional']);
});

it('says what an assignment did, and a count of what is loaded', () => {
  expect(assignedText('billing', 'Billing UI', 'optional')).toBe(
    'billing is assigned to Billing UI as optional.',
  );
  expect(unassignedText('billing', 'Billing UI')).toBe(
    'billing is no longer assigned to Billing UI.',
  );
  expect(clientsCount(1, false)).toBe('1 client.');
  expect(clientsCount(50, true)).toBe('50 clients shown, with more to load.');
});

it('names the bound a client holds when the server refuses over it', () => {
  expect(
    clientAssignmentFailure(
      {
        ok: false,
        kind: 'problem',
        problem: {
          type: 'about:blank',
          title: 'Conflict',
          status: 409,
          detail: 'a client carries at most 200 scopes',
        },
      },
      'billing',
      'Billing UI',
      'assigned',
    ),
  ).toMatch(/a client carries at most 200 scopes/u);
});
