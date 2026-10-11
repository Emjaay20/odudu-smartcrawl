import { expect, it } from 'vitest';
import {
  CONSENT_RULE,
  displayOrderProblem,
  generalPatch,
  scopeFailureFields,
} from '#/features/scopes/service';

it('accepts a whole number from zero, and nothing else', () => {
  expect(displayOrderProblem('0')).toBeNull();
  expect(displayOrderProblem('12')).toBeNull();
  expect(displayOrderProblem('')).toMatch(/whole number/u);
  expect(displayOrderProblem('-1')).toMatch(/whole number/u);
  expect(displayOrderProblem('1.5')).toMatch(/whole number/u);
  expect(displayOrderProblem('2147483648')).toMatch(/at most/u);
});

it('sends an emptied description or consent text as null, a number as a number', () => {
  expect(generalPatch({ description: '' })).toEqual({ description: null });
  expect(generalPatch({ consent_text: '  ' })).toEqual({ consent_text: null });
  expect(generalPatch({ display_order: '4', include_in_id_token: true })).toEqual({
    display_order: 4,
    include_in_id_token: true,
  });
  expect(generalPatch({ default_client_assignment: 'none' })).toEqual({
    default_client_assignment: null,
  });
  expect(generalPatch({ default_client_assignment: 'optional' })).toEqual({
    default_client_assignment: 'optional',
  });
});

it('states the consent limit', () => {
  expect(CONSENT_RULE).toMatch(/500/u);
});

it('places a refusal under the fields the form has', () => {
  expect(scopeFailureFields).toEqual([
    'name',
    'description',
    'include_in_id_token',
    'include_in_access_token',
    'default_client_assignment',
    'consent_text',
    'display_order',
  ]);
});
