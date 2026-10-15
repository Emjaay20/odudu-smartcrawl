import { type Config } from '@odudu/kernel';
import { type ThrottleSettings } from '#/app';

export interface ThrottleSettingsByBudget {
  throttle: ThrottleSettings;
  loginThrottle: ThrottleSettings;
  clientSecretThrottle: ThrottleSettings;
}

export function throttleSettingsFrom(config: Config): ThrottleSettingsByBudget {
  return {
    throttle: {
      limit: config.ODUDU_THROTTLE_LIMIT,
      windowSeconds: config.ODUDU_THROTTLE_WINDOW_SECONDS,
    },
    loginThrottle: {
      limit: config.ODUDU_LOGIN_THROTTLE_LIMIT,
      windowSeconds: config.ODUDU_LOGIN_THROTTLE_WINDOW_SECONDS,
    },
    clientSecretThrottle: {
      limit: config.ODUDU_CLIENT_SECRET_THROTTLE_LIMIT,
      windowSeconds: config.ODUDU_CLIENT_SECRET_THROTTLE_WINDOW_SECONDS,
    },
  };
}
