import { describe, expect, it } from 'vitest';
import { offeredLocales, offeredRead } from '#/shared/service/offeredLocales';
import type { GatewayFailure } from '#/shared/service/result';

describe('the languages a tenant offers', () => {
  it('reads supported_locales out of the settings record', () => {
    expect(offeredLocales({ supported_locales: ['en', 'fr', 'pt-BR'] })).toEqual([
      'en',
      'fr',
      'pt-BR',
    ]);
  });

  it('keeps only the tags, and offers none when the setting is not a list', () => {
    expect(offeredLocales({ supported_locales: ['en', 3, null, 'fr'] })).toEqual(['en', 'fr']);
    expect(offeredLocales({ supported_locales: 'en' })).toEqual([]);
    expect(offeredLocales({})).toEqual([]);
  });
});

describe('the languages as a read', () => {
  const retry = () => undefined;
  const failure = (status: number): GatewayFailure => ({
    ok: false,
    kind: 'problem',
    problem: { type: 'about:blank', title: 'Refused', status },
  });

  it('offers what the settings say once they are read', () => {
    expect(
      offeredRead({
        status: 'ready',
        data: { supported_locales: ['en', 'fr'] },
        failure: null,
        retry,
      }),
    ).toEqual({ status: 'ready', data: ['en', 'fr'] });
  });

  it('is loading until the settings answer', () => {
    expect(offeredRead({ status: 'loading', data: undefined, failure: null, retry })).toEqual({
      status: 'loading',
    });
  });

  it('says a refusal was one, and a failure was not', () => {
    expect(
      offeredRead({ status: 'failed', data: undefined, failure: failure(403), retry }),
    ).toMatchObject({ status: 'failed', refused: true });
    expect(
      offeredRead({ status: 'failed', data: undefined, failure: failure(500), retry }),
    ).toMatchObject({ status: 'failed', refused: false });
  });
});
