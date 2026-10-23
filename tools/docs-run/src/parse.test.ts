import { describe, expect, it } from 'vitest';
import { extractRunnable, lintCommand, type RunnableBlock } from '#/parse';

const block = (command: string): RunnableBlock => ({
  file: 'guide.md',
  line: 1,
  command,
  expect: [],
  env: {},
});

describe('extractRunnable', () => {
  it('reads a tagged block with its attributes and the line it starts on', () => {
    const md = [
      '# Title',
      '',
      '```sh {run expect="signed in" expect="ok" timeout=30}',
      'echo hi',
      '```',
    ].join('\n');
    expect(extractRunnable(md, 'a.md')).toEqual([
      {
        file: 'a.md',
        line: 3,
        command: 'echo hi',
        expect: ['signed in', 'ok'],
        env: {},
        timeoutSeconds: 30,
      },
    ]);
  });

  it('refuses an attribute it would otherwise ignore, such as an unquoted expect', () => {
    expect(() => extractRunnable('```sh {run expect=Bearer}\nls\n```', 'a.md')).toThrow(
      /a\.md:1.*expect=Bearer/u,
    );
    expect(() => extractRunnable('```sh {run expect="a"b"}\nls\n```', 'a.md')).toThrow(/a\.md:1/u);
  });

  it('reads a block with no attributes', () => {
    const [only] = extractRunnable('```sh {run}\nls\n```', 'a.md');
    expect(only?.command).toBe('ls');
    expect(only?.expect).toEqual([]);
  });

  it('ignores an untagged block, a sh block without run, and other languages', () => {
    const md = ['```', 'a', '```', '```sh', 'b', '```', '```text {run}', 'c', '```'].join('\n');
    expect(extractRunnable(md, 'a.md')).toEqual([]);
  });

  it('keeps a three-tick example inside a four-tick fence as content', () => {
    const md = [
      '````md',
      '```sh {run}',
      'echo nested',
      '```',
      '````',
      '```sh {run}',
      'echo real',
      '```',
    ].join('\n');
    const found = extractRunnable(md, 'a.md');
    expect(found.map((b) => b.command)).toEqual(['echo real']);
    expect(found[0]?.line).toBe(6);
  });

  it('closes a fence only on a run of ticks at least as long as the opener', () => {
    const md = ['````sh {run}', 'echo a', '```', 'echo b', '````'].join('\n');
    expect(extractRunnable(md, 'a.md')[0]?.command).toBe('echo a\n```\necho b');
  });

  it('returns the command byte for byte', () => {
    const [only] = extractRunnable('```sh {run}\nprintf "%s" \'a  b\'\n```', 'a.md');
    expect(only?.command).toBe('printf "%s" \'a  b\'');
  });
});

describe('lintCommand', () => {
  it('passes a plain command', () => {
    expect(lintCommand(block('curl -fsS "$ODUDU_BASE/health/ready"'))).toEqual([]);
  });

  it.each([
    ['a left single quote', 'echo ‘hi'],
    ['a right single quote', 'echo hi’'],
    ['a left double quote', 'echo “hi'],
    ['a right double quote', 'echo hi”'],
    ['a non-breaking hyphen', 'curl ‑s x'],
    ['a hyphen character', 'curl ‐s x'],
    ['an en dash', 'curl –s x'],
    ['an em dash', 'curl —s x'],
    ['a horizontal bar', 'curl ―s x'],
    ['a minus sign', 'curl −s x'],
    ['a leading dollar prompt', '$ echo hi'],
    ['a leading angle prompt', '> echo hi'],
    ['a trailing backslash', 'echo hi \\'],
    ['two command lines', 'echo a\necho b'],
    ['a tab', 'echo\ta'],
    ['a trailing space', 'echo a '],
    ['a zero-width space', 'echo a​b'],
    ['a byte order mark', '﻿echo a'],
  ])('refuses %s', (_name, command) => {
    expect(lintCommand(block(command)).length).toBeGreaterThan(0);
  });

  it('names the line and the character it found', () => {
    const [finding] = lintCommand(block('echo ‘hi'));
    expect(finding).toContain('guide.md:1');
    expect(finding).toContain('U+2018');
  });

  it('allows && on one line', () => {
    expect(
      lintCommand(block('curl -fsSLO https://example.test/compose.yaml && docker compose up -d')),
    ).toEqual([]);
  });

  it('does not flag a leading dollar that is a variable', () => {
    expect(lintCommand(block('$HOME/bin/tool'))).toEqual([]);
  });
});
