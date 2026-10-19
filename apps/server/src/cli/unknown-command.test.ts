import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const MAIN = fileURLToPath(new URL('../main.ts', import.meta.url));

function run(args: readonly string[], env: Record<string, string> = {}) {
  return spawnSync(process.execPath, [MAIN, ...args], {
    encoding: 'utf8',
    timeout: 30_000,
    env: { PATH: process.env.PATH ?? '', ...env },
  });
}

describe('odudu with a first argument', { timeout: 60_000 }, () => {
  it('does not start the server for an unknown subcommand', () => {
    const result = run(['sead']);

    expect(result.status).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('unknown command "sead"');
    expect(result.stderr).toContain('Usage: odudu <command>');
  });

  it('refuses help for an unknown command with the same exit code and the help', () => {
    const result = run(['help', 'nope']);

    expect(result.status).toBe(2);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('unknown command "odudu nope"');
    expect(result.stderr).toContain('Usage: odudu <command>');
  });

  it('describes help and --version through help', () => {
    expect(run(['help', 'help']).status).toBe(0);
    expect(run(['help', '--version']).status).toBe(0);
  });

  it('prints help on stdout and exits 0 for help, --help and -h', () => {
    for (const flag of ['help', '--help', '-h']) {
      const result = run([flag]);
      expect(result.status, flag).toBe(0);
      expect(result.stdout, flag).toContain('Usage: odudu');
    }
  });

  it('prints help for one command', () => {
    const result = run(['help', 'seed', 'client']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('--public');
  });

  it('prints ODUDU_VERSION, or dev, for --version', () => {
    expect(run(['--version']).stdout.trim()).toBe('dev');
    expect(run(['--version'], { ODUDU_VERSION: '1.2.3' }).stdout.trim()).toBe('1.2.3');
  });
});
