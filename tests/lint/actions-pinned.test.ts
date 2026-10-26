import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const GITHUB = path.join(REPO_ROOT, '.github');

function files(): string[] {
  const workflows = readdirSync(path.join(GITHUB, 'workflows')).map((name) =>
    path.join('workflows', name),
  );
  const actions = readdirSync(path.join(GITHUB, 'actions')).map((name) =>
    path.join('actions', name, 'action.yml'),
  );
  return [...workflows, ...actions];
}

// A mutable tag lets whoever controls the action change what runs here, and
// main-branch jobs write the shared caches. A commit cannot be moved.
// Cannot see: an action called through `docker://` or a reusable workflow in
// another repository; none exists.
describe('every action a workflow or a composite action runs', () => {
  const uses = files().flatMap((file) =>
    [...readFileSync(path.join(GITHUB, file), 'utf8').matchAll(/^\s+(?:- )?uses: (\S+)(.*)$/gmu)]
      .filter(([, action]) => !(action ?? '').startsWith('./'))
      .map(([, action = '', rest = '']) => ({ file, action, rest })),
  );

  it('finds them', () => {
    expect(uses.length).toBeGreaterThan(40);
  });

  it('is pinned to a commit, with its version beside it', () => {
    for (const { file, action, rest } of uses) {
      expect(action, `${file}: ${action}`).toMatch(
        /^[\w.-]+\/[\w.-]+(?:\/[\w.-]+)*@[0-9a-f]{40}$/u,
      );
      expect(rest.trim(), `${file}: ${action}`).toMatch(/^# v\d+\.\d+\.\d+$/u);
    }
  });
});
