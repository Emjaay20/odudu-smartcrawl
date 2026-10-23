import { flag, text } from '#/cli/command-types';
import { DEFAULT_ADMIN_EMAIL, DEFAULT_PUBLIC_BASE_URL } from '#/cli/init-plan';

export const DEFAULT_STATE_DIR = '/var/lib/odudu';

export const INIT_OPTIONS = {
  'admin-email': text(
    'Email address of the first administrator, who signs in with it. Defaults to ODUDU_ADMIN_EMAIL, then ' +
      DEFAULT_ADMIN_EMAIL +
      ' when there is no terminal to ask on or ODUDU_ADMIN_PASSWORD is set.',
  ),
  'state-dir': text('Directory that holds quickstart.env. Defaults to ' + DEFAULT_STATE_DIR + '.'),
  'add-admin': flag(
    'Add an administrator when the system tenant already has one; without it a ' +
      'different --admin-email is refused.',
  ),
  'public-base-url': text(
    'Address the server is reached at, loopback only. Defaults to ODUDU_PUBLIC_BASE_URL, ' +
      'then ' +
      DEFAULT_PUBLIC_BASE_URL +
      '.',
  ),
} as const;
