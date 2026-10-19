import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderBanner } from '../../apps/server/src/cli/banner.js';
import { PROMPT_LABELS } from '../../apps/server/src/cli/prompt.js';
import {
  DEFAULT_STATE_DIR,
  existingAdministratorMessage,
  REQUIRED_KEYS,
  rolesWithoutSecretsMessage,
  SECRETS_FILE_MODE,
  secondAdministratorMessage,
  STATE_DIR_MODE,
} from '../../apps/server/src/cli/init.js';
import {
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_PUBLIC_BASE_URL,
  loopbackRefusal,
} from '../../apps/server/src/cli/init-plan.js';
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
    expect(readme).toContain(`email:    ${DEFAULT_ADMIN_EMAIL}`);
    expect(section).toContain(`\`${DEFAULT_ADMIN_EMAIL}\``);
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

  it('shows the exit status of each refusal, and of the re-run that succeeds', () => {
    const shown = transcript.split('\n').filter((line) => line.endsWith('echo "exit $?"'));
    expect(shown).toHaveLength(4);
    expect(transcript.match(/^exit 1$/gmu)).toHaveLength(3);
    expect(transcript.match(/^exit 0$/gmu)).toHaveLength(1);
  });
});

const composeStart = readme.indexOf('**Quickstart with Docker Compose.**');
const composeSection = readme.slice(composeStart, start);
const composeBlocks = [...composeSection.matchAll(/```\n([\s\S]*?)```/gu)].map((m) => m[1] ?? '');

describe('the README paragraph on the Compose quickstart', () => {
  const url = 'http://localhost:3250/console/';

  it('shows the bare command and the banner the server prints for it', () => {
    const [bare = ''] = composeBlocks;
    expect(
      bare.startsWith('$ docker compose up -d\n$ docker compose logs --no-log-prefix setup\n'),
    ).toBe(true);
    expect(bare).toContain(
      renderBanner({
        consoleUrl: url,
        adminEmail: DEFAULT_ADMIN_EMAIL,
        generatedPassword: '<generated>',
        created: true,
      }),
    );
  });

  it('shows the prompted run and the start that follows it', () => {
    const [, prompted = ''] = composeBlocks;
    expect(prompted.startsWith('$ docker compose run --rm setup\n')).toBe(true);
    expect(prompted).toContain(PROMPT_LABELS.email.trimEnd());
    expect(prompted).toContain(PROMPT_LABELS.password.trimEnd());
    expect(prompted).toContain(PROMPT_LABELS.repeat.trimEnd());
    expect(prompted).toContain(
      renderBanner({ consoleUrl: url, adminEmail: 'grace@example.com', created: true }),
    );
    expect(prompted).toContain(
      '$ docker compose up -d\n$ docker compose logs --no-log-prefix setup\n',
    );
    expect(prompted).toContain(existingAdministratorMessage(undefined, url));
  });

  it('says what the default address, the loopback bind and NODE_ENV mean', () => {
    expect(composeSection).toContain(`\`${DEFAULT_ADMIN_EMAIL}\` is public knowledge`);
    expect(composeSection).toContain('loopback');
    expect(composeSection).toContain('not a production deployment');
    expect(composeSection).toContain('NODE_ENV=development');
    expect(composeSection).toContain('TLS');
  });

  it('states what happens with an environment password and no email on a terminal', () => {
    expect(composeSection).toMatch(/ODUDU_ADMIN_PASSWORD.*without asking for the email/su);
  });
});
