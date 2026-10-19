import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CLI_COMMANDS } from '../../apps/server/src/cli/registry.js';

describe('the README paragraph on odudu init', () => {
  const readme = readFileSync(new URL('../../README.md', import.meta.url), 'utf8');
  const init = CLI_COMMANDS.find((command) => command.name === 'init');

  it('names every option the registry gives init', () => {
    expect(init?.options.length).toBeGreaterThan(0);
    for (const option of init?.options ?? []) {
      expect(readme, `--${option.name}`).toContain(`\`--${option.name}\``);
    }
  });

  it('names the environment variables and the refusal it documents', () => {
    for (const name of ['ODUDU_DATABASE_URL', 'ODUDU_ADMIN_PASSWORD', 'quickstart.env']) {
      expect(readme, name).toContain(name);
    }
    expect(readme).toContain('the odudu_svc role exists but');
  });
});
