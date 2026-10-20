// Photographs the console for the documentation (pnpm docs:screenshots; --check
// recaptures and fails when a record or the size manifest differs; images are
// not compared byte for byte, a frame differs in a few pixels between runs).
// Writes static/console/*.webp, manifest.json and record/*.txt (the text each
// page held). Through the console it creates the tenant demo, the client my-app
// and the person ada if missing: use a stack made for this, on this machine.
// ODUDU_BASE, ODUDU_ADMIN_EMAIL and ODUDU_ADMIN_PASSWORD name it; any other
// host than this machine needs ODUDU_SCREENSHOTS_ALLOW_REMOTE=1.
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { captureScreens, writeCaptures } from './capture.ts';
import { SCREENS } from './screens.ts';

const required = (name: string): string => {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`${name} is not set: the capture signs in to a running stack`);
  }
  return value;
};

const base = process.env.ODUDU_BASE ?? 'http://localhost:3000';
const host = new URL(base).hostname;
if (
  !['localhost', '127.0.0.1', '[::1]'].includes(host) &&
  process.env.ODUDU_SCREENSHOTS_ALLOW_REMOTE !== '1'
) {
  throw new Error(
    `${host} is not this machine: the capture creates a tenant, a client and a person`,
  );
}

const final = {
  outDir: path.resolve(import.meta.dirname, '../../static/console'),
  recordDir: path.resolve(import.meta.dirname, 'record'),
};
const options = {
  base,
  adminUsername: required('ODUDU_ADMIN_EMAIL'),
  adminPassword: required('ODUDU_ADMIN_PASSWORD'),
};

const result = await captureScreens(SCREENS, { ...options, ...final });
if (process.argv.includes('--check')) {
  const scratch = mkdtempSync(path.join(tmpdir(), 'odudu-shots-'));
  const fresh = { outDir: path.join(scratch, 'images'), recordDir: path.join(scratch, 'record') };
  writeCaptures(result, fresh);
  const same = (left: string, right: string): boolean =>
    readFileSync(left).equals(readFileSync(right));
  const differing = [
    ...readdirSync(fresh.recordDir).filter(
      (file) => !same(path.join(fresh.recordDir, file), path.join(final.recordDir, file)),
    ),
    ...(same(path.join(fresh.outDir, 'manifest.json'), path.join(final.outDir, 'manifest.json'))
      ? []
      : ['manifest.json']),
  ];
  if (differing.length > 0)
    throw new Error(`the console no longer matches: ${differing.join(', ')}`);
  process.stdout.write(`${String(result.captures.length)} captures match the committed records\n`);
} else {
  writeCaptures(result, final);
  process.stdout.write(`captured ${String(Object.keys(result.manifest).length)} screens\n`);
}
