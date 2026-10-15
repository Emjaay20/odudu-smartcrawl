import { loadConfig } from '@odudu/kernel';
import { describe, expect, it } from 'vitest';
import { throttleSettingsFrom } from '#/throttle-settings';

describe('throttleSettingsFrom', () => {
  it('hands each budget the pair of settings that names it', () => {
    const config = loadConfig({
      ODUDU_DATABASE_URL: 'postgres://u:p@localhost:5432/odudu',
      ODUDU_KEK: Buffer.alloc(32, 9).toString('base64'),
      ODUDU_THROTTLE_LIMIT: '11',
      ODUDU_THROTTLE_WINDOW_SECONDS: '12',
      ODUDU_LOGIN_THROTTLE_LIMIT: '21',
      ODUDU_LOGIN_THROTTLE_WINDOW_SECONDS: '22',
      ODUDU_CLIENT_SECRET_THROTTLE_LIMIT: '31',
      ODUDU_CLIENT_SECRET_THROTTLE_WINDOW_SECONDS: '32',
    });

    expect(throttleSettingsFrom(config)).toEqual({
      throttle: { limit: 11, windowSeconds: 12 },
      loginThrottle: { limit: 21, windowSeconds: 22 },
      clientSecretThrottle: { limit: 31, windowSeconds: 32 },
    });
  });
});
