import { expect, it } from 'vitest';
import {
  FALLBACK_TEXT,
  mapperOptions,
  mappersFailure,
  mappersFailureText,
  mappersSummary,
} from '#/features/scopes/service';

it('offers every available mapper, in the order the registry names them', () => {
  expect(mapperOptions(['email', 'groups'])).toEqual([
    { id: 'email', label: 'email' },
    { id: 'groups', label: 'groups' },
  ]);
});

it('says a scope with no binding falls back to its declared mappers', () => {
  expect(mappersSummary([])).toBe(FALLBACK_TEXT);
  expect(FALLBACK_TEXT).toMatch(/falls back to the scope's declared mappers/u);
  expect(mappersSummary(['email'])).toBe('Bound: email.');
});

it('names the registry in a 400 for an unknown mapper', () => {
  expect(
    mappersFailureText({
      ok: false,
      kind: 'problem',
      problem: {
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        detail: 'unknown mapper name(s): nope; known: email, groups',
      },
    }),
  ).toBe('Not saved: no mapper named nope. The mappers are email and groups.');
});

it('has nothing to add for another failure', () => {
  expect(
    mappersFailureText({
      ok: false,
      kind: 'problem',
      problem: { type: 'about:blank', title: 'Conflict', status: 409 },
    }),
  ).toBeNull();
});

it('puts the unknown-mapper wording under the mapper field', () => {
  const failure = {
    ok: false as const,
    kind: 'problem' as const,
    problem: {
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      detail: 'unknown mapper name(s): nope; known: email, groups',
      errors: [{ path: 'mapper_names', message: 'names no registered mapper nope' }],
    },
  };
  expect(mappersFailure(failure).problem.errors).toEqual([
    {
      path: 'mapper_names',
      message: 'Not saved: no mapper named nope. The mappers are email and groups.',
    },
  ]);
  const other = { ...failure, problem: { ...failure.problem, status: 409 } };
  expect(mappersFailure(other)).toBe(other);
});
