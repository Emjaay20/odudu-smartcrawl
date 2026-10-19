import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STATE_DIR,
  existingAdministratorMessage,
  REQUIRED_KEYS,
  rolesWithoutSecretsMessage,
  SECRETS_FILE_MODE,
  secondAdministratorMessage,
  STATE_DIR_MODE,
} from '../../apps/server/src/cli/init.js';
import { DEFAULT_PUBLIC_BASE_URL, loopbackRefusal } from '../../apps/server/src/cli/init-plan.js';
import { CLI_COMMANDS } from '../../apps/server/src/cli/registry.js';

const readme = readFileSync(new URL('../../README.md', import.meta.url), 'utf8');
const start = readme.indexOf('Quickstart: `odudu init`');
const section = readme.slice(start, readme.indexOf('**Bootstrap the first administrator.**'));
const transcript = /```\n(\$ odudu init[\s\S]*?)```/u.exec(section)?.[1] ?? '';
const octal = (mode: number): string => mode.toString(8).padStart(4, '0');

describe('the README paragraph on odudu init', () => {
  it('finds the paragraph and its transcript', () => {
    expect(start).toBeGreaterThan(0);
    expect(transcript.length).toBeGreaterThan(0);
  });

  it('names every option the registry gives init', () => {
    const init = CLI_COMMANDS.find((command) => command.name === 'init');
    expect(init?.options.length).toBeGreaterThan(0);
    for (const option of init?.options ?? []) {
      expect(section, `--${option.name}`).toContain(`\`--${option.name}\``);
    }
  });

  it('states the defaults and modes the code uses', () => {
    expect(section).toContain(`\`${DEFAULT_STATE_DIR}\``);
    expect(section).toContain(`\`${DEFAULT_PUBLIC_BASE_URL}\``);
    expect(section).toContain(`\`${octal(SECRETS_FILE_MODE)}\``);
    expect(section).toContain(`\`${octal(STATE_DIR_MODE)}\``);
  });

  it('shows the messages init prints and refuses with, word for word', () => {
    const consoleUrl = `${DEFAULT_PUBLIC_BASE_URL}/console/`;
    expect(transcript).toContain(existingAdministratorMessage('ada@example.com', consoleUrl));
    expect(transcript).toContain(secondAdministratorMessage('grace@example.com'));
    expect(transcript).toContain(loopbackRefusal('https://id.example.com'));
    expect(transcript).toContain(rolesWithoutSecretsMessage('state/quickstart.env'));
  });

  it('shows the modes it states: a 0700 directory and a 0600 file', () => {
    expect(transcript).toContain(`${octal(STATE_DIR_MODE)} state\n`);
    expect(transcript).toContain(`${octal(SECRETS_FILE_MODE)} state/quickstart.env\n`);
  });

  it('lists the variables quickstart.env holds, in order', () => {
    const listed = REQUIRED_KEYS.join('\n');
    expect(transcript).toContain(`\n${listed}\n`);
  });

  it('shows the exit status of each refusal', () => {
    const refusals = transcript.split('\n').filter((line) => line.endsWith('echo "exit $?"'));
    expect(refusals).toHaveLength(3);
    expect(transcript.match(/^exit 1$/gmu)).toHaveLength(refusals.length);
  });
});
