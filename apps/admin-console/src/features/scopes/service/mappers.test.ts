import { expect, it } from 'vitest';
import {
  NONE_TEXT,
  mapperOptions,
  mappersFailure,
  mappersFailureText,
  mappersSummary,
  describeMappers,
} from '#/features/scopes/service';

it('offers every available mapper, in the order the registry names them', () => {
  expect(mapperOptions(['email', 'groups'])).toEqual([
    { id: 'email', label: 'email' },
    { id: 'groups', label: 'groups' },
  ]);
});

it('names the declared mappers a scope with no binding falls back to', () => {
  expect(mappersSummary([], ['email', 'groups'])).toBe(
    'No mapper is bound, so this scope uses the mappers that declare it: email and groups.',
  );
  expect(mappersSummary(['email'], ['groups'])).toBe('Bound: email.');
});

it('says so when nothing is bound and nothing declares the scope', () => {
  expect(mappersSummary([], [])).toBe(NONE_TEXT);
  expect(NONE_TEXT).toMatch(/none declares it/u);
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

it('reads a draft mapper list as a sentence, and an empty or odd one as none', () => {
  expect(describeMappers(['email', 'groups'])).toBe('email and groups');
  expect(describeMappers([])).toBe('none');
  expect(describeMappers(undefined)).toBe('none');
});
