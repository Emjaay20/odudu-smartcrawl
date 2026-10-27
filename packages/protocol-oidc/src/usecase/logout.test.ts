import { describe, expect, it } from 'vitest';
import { MAX_FRONT_CHANNEL_FRAMES } from '#/service/frontchannel-logout';
import {
  decideLogout,
  decideRedirect,
  frontChannelLogoutUrls,
  type LogoutSession,
} from '#/usecase/logout';

const registered = ['https://app.example/after-logout'];
const session: LogoutSession = { id: 's1', subjectId: 'u1' };

describe('decideLogout', () => {
  it('asks when a session is present, whatever the request carries', () => {
    // No hint field exists: a hint (valid, expired, matching sid or not)
    // only identifies the session, and never licenses ending it by GET.
    expect(decideLogout({ session, requested: null, registered })).toEqual({ kind: 'confirm' });
  });

  it('asks even with a registered redirect', () => {
    expect(
      decideLogout({ session, requested: 'https://app.example/after-logout', registered }),
    ).toEqual({ kind: 'confirm' });
  });

  describe('with no live session', () => {
    it('confirms (nothing to end, no redirect requested)', () => {
      expect(
        decideLogout({
          session: null,
          requested: null,
          registered,
        }),
      ).toEqual({ kind: 'confirm' });
    });

    it('confirms rather than redirecting to an unregistered uri', () => {
      expect(
        decideLogout({
          session: null,
          requested: 'https://evil.example/after-logout',
          registered,
        }),
      ).toEqual({ kind: 'confirm' });
    });

    it('still redirects to an exactly matching registered uri, per §3', () => {
      // §3 forbids redirecting to an *unmatched* URI; it says nothing
      // against honouring a matched one when there is nothing to end — an
      // RP sending a user to logout after their session already idled out
      // must not be stranded with no way back.
      expect(
        decideLogout({
          session: null,
          requested: 'https://app.example/after-logout',
          registered,
        }),
      ).toEqual({ kind: 'end', redirectTo: 'https://app.example/after-logout' });
    });
  });
});

describe('frontChannelLogoutUrls', () => {
  it('asks for no more than the frame bound, and builds a URL per client', async () => {
    const asked: number[] = [];
    const urls = await frontChannelLogoutUrls(
      {
        frontChannelClientsForSession: (_tenant, _session, limit) => {
          asked.push(limit);
          return Promise.resolve([
            {
              frontchannelLogoutUri: 'https://rp.example/logout',
              frontchannelLogoutSessionRequired: true,
            },
          ]);
        },
      },
      'tenant',
      'https://issuer.example',
      's1',
    );
    expect(asked).toEqual([MAX_FRONT_CHANNEL_FRAMES]);
    expect(urls).toHaveLength(1);
  });
});

describe('decideRedirect', () => {
  it('ends at an exactly matching registered uri', () => {
    expect(decideRedirect('https://app.example/after-logout', registered)).toEqual({
      kind: 'end',
      redirectTo: 'https://app.example/after-logout',
    });
  });

  it('ends with no redirect when none was requested', () => {
    expect(decideRedirect(null, registered)).toEqual({ kind: 'end', redirectTo: null });
  });

  it.each([
    ['https://app.example/after-logout/'],
    ['https://app.example/after-logout?x=1'],
    ['https://APP.example/after-logout'],
    ['https://evil.example/after-logout'],
  ])('renders rather than redirecting to %s', (requested) => {
    expect(decideRedirect(requested, registered)).toEqual({
      kind: 'render',
      error: 'invalid_request',
    });
  });
});
