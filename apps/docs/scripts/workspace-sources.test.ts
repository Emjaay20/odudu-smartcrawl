import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// `@odudu/docs#build` in turbo.json does not depend on the workspace packages'
// builds, because the generator reads their sources. That holds only while each
// package a docs build imports exports its source, not a build output.
const APP = path.resolve(import.meta.dirname, '..');

function manifest(file: string): { devDependencies?: Record<string, string>; exports?: unknown } {
  return JSON.parse(readFileSync(file, 'utf8')) as {
    devDependencies?: Record<string, string>;
    exports?: unknown;
  };
}

function directory(name: string): string {
  const short = name.replace('@odudu/', '');
  const candidates = [`../../packages/${short}`, `../../apps/${short}`];
  const found = candidates.map((candidate) => path.resolve(APP, candidate)).find(existsSync);
  if (found === undefined) throw new Error(`${name} is not in the workspace`);
  return found;
}

function targets(exported: unknown): string[] {
  if (typeof exported === 'string') return [exported];
  if (typeof exported !== 'object' || exported === null) return [];
  return Object.values(exported).flatMap(targets);
}

describe('the workspace packages the docs build imports', () => {
  const workspace = Object.entries(manifest(path.join(APP, 'package.json')).devDependencies ?? {})
    .filter(([, version]) => version.startsWith('workspace:'))
    .map(([name]) => name);

  it('are found, so the check does not pass over nothing', () => {
    expect(workspace.length).toBeGreaterThanOrEqual(5);
  });

  it.each(workspace)('%s exports its source, not a build', (name) => {
    const { exports } = manifest(path.join(directory(name), 'package.json'));
    for (const target of targets(exports)) expect(target, name).toMatch(/^\.\/src\//u);
  });
});
