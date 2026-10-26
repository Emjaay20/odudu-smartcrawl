import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const CONFIG = readFileSync(path.join(REPO_ROOT, '.github/dependabot.yml'), 'utf8');
const WORKSPACE = readFileSync(path.join(REPO_ROOT, 'pnpm-workspace.yaml'), 'utf8');

const npmEntries = CONFIG.split(/^(?=  - package-ecosystem: )/mu).filter((entry) =>
  entry.startsWith('  - package-ecosystem: npm'),
);

// pnpm installs nothing younger than minimumReleaseAge, so a Dependabot pull
// request for a version that new would fail to install.
describe('Dependabot for npm', () => {
  it('waits longer than pnpm does before it proposes a version', () => {
    const minutes = Number(/^minimumReleaseAge: (\d+)/mu.exec(WORKSPACE)?.[1]);
    expect(minutes).toBeGreaterThan(0);
    expect(npmEntries.length).toBeGreaterThan(3);
    for (const entry of npmEntries) {
      const days = Number(/^ {4}cooldown:\n {6}default-days: (\d+)$/mu.exec(entry)?.[1]);
      expect(days * 24 * 60, entry.split('\n')[1]).toBeGreaterThan(minutes);
    }
  });
});
