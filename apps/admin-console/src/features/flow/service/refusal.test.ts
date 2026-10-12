import { describe, expect, it } from 'vitest';
import { flowFailure, flowRefusalText } from '#/features/flow/service/refusal';

const bad = (detail: string, errors?: { path: string; message: string }[]) => ({
  ok: false as const,
  kind: 'problem' as const,
  problem: {
    type: 'about:blank',
    title: 'Bad Request',
    status: 400,
    detail,
    ...(errors === undefined ? {} : { errors }),
  },
});

describe('flowRefusalText', () => {
  it('words a flow with no step', () => {
    expect(
      flowRefusalText(
        'a flow needs at least one step; a tenant with no flow cannot be logged into',
      ),
    ).toMatch(/^The flow has no step\./u);
  });

  it('words a flow whose every step is disabled', () => {
    expect(
      flowRefusalText(
        'every step is disabled; a tenant with no enabled step cannot be logged into',
      ),
    ).toMatch(/^Every step is disabled/u);
  });

  it('words a flow with no first challenge, naming what can start a sign-in', () => {
    const text = flowRefusalText(
      'no step would run at the start of a login, when no subject is bound yet; a tenant whose flow begins this way cannot be logged into',
    );
    expect(text).toContain('only the password step can run');
    expect(text).toContain('cannot be skipped');
  });

  it('names the authenticators an unknown one was not among', () => {
    expect(
      flowRefusalText(
        'unknown authenticator "sms"; expected one of password, passkey, otp, recovery-code',
      ),
    ).toBe(
      '“sms” is not an authenticator this server has. It has password, passkey, otp and recovery-code.',
    );
  });

  it('words a repeated authenticator', () => {
    expect(
      flowRefusalText(
        'authenticator "otp" appears more than once; a step is addressed by its authenticator, so a repeat has no unambiguous meaning',
      ),
    ).toBe('“otp” is a step twice. An authenticator is one step.');
  });

  it('keeps the server’s own words for a refusal it does not know', () => {
    expect(flowRefusalText('something new')).toBe('something new');
  });
});

describe('flowFailure', () => {
  it('puts a 400 under the steps, worded, in place of the paths the server named', () => {
    const failure = flowFailure(
      bad('every step is disabled; x', [{ path: '[0].authenticator', message: 'm' }]),
    );
    const errors = failure.problem.errors ?? [];
    expect(errors.map((error) => error.path)).toEqual(['steps']);
    expect(errors[0]?.message).toMatch(/^Every step/u);
  });

  it('leaves anything else as it came', () => {
    const lost = { ok: false as const, kind: 'network' as const };
    expect(flowFailure(lost)).toBe(lost);
    const stale = {
      ok: false as const,
      kind: 'problem' as const,
      problem: { type: 'about:blank', title: 'x', status: 412 },
    };
    expect(flowFailure(stale)).toBe(stale);
  });
});
