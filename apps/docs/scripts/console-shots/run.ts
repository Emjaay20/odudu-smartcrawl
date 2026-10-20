import path from 'node:path';
import { captureScreens } from './capture.ts';
import { SCREENS } from './screens.ts';

const required = (name: string): string => {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`${name} is not set: the capture signs in to a running stack`);
  }
  return value;
};

const manifest = await captureScreens(SCREENS, {
  base: process.env.ODUDU_BASE ?? 'http://localhost:3000',
  adminUsername: required('ODUDU_ADMIN_EMAIL'),
  adminPassword: required('ODUDU_ADMIN_PASSWORD'),
  outDir: path.resolve(import.meta.dirname, '../../static/console'),
});
process.stdout.write(`captured ${String(Object.keys(manifest).length)} screens\n`);
