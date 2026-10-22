import { type DatabaseHandle } from '@odudu/db';
import { loadConfig } from '@odudu/kernel';
import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { appDepsFromConfig } from '#/app-deps';

const env = {
  ODUDU_DATABASE_URL: 'postgres://user:pw@localhost:5432/odudu',
  ODUDU_KEK: Buffer.alloc(32, 9).toString('base64'),
};
const parts = {
  runtime: {} as DatabaseHandle,
  owner: {} as DatabaseHandle,
  logger: pino({ level: 'silent' }),
  consoleKeys: undefined,
  deploymentSmtp: false,
};

describe('appDepsFromConfig', () => {
  it.each([
    ['true', true],
    ['false', false],
  ])('hands ODUDU_TLS=%s to the app as the one setting every cookie follows', (value, tls) => {
    expect(appDepsFromConfig(loadConfig({ ...env, ODUDU_TLS: value }), parts).tls).toBe(tls);
  });

  it('is off when ODUDU_TLS is unset, as the development stack runs', () => {
    expect(appDepsFromConfig(loadConfig(env), parts).tls).toBe(false);
  });
});
