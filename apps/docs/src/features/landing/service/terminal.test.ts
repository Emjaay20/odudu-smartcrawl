import { describe, expect, it, vi } from 'vitest';
import { COMMANDS, RELEASE_CAVEAT } from '@site/src/features/landing/service/content';
import {
  commandOf,
  copyLabel,
  copyText,
  lineVisible,
  noteFor,
  overlayShown,
  segments,
  typedSegments,
  typingAfterChoice,
} from '@site/src/features/landing/service/terminal';

const COMMAND = COMMANDS[0]?.command ?? '';

describe('the hero terminal', () => {
  it('breaks a command after each slash and loses nothing', () => {
    expect(segments('curl https://a.b/c/d').join('')).toBe('curl https://a.b/c/d');
    expect(segments('x/y/z')).toEqual(['x/', 'y/', 'z']);
  });

  it('shows the first characters and keeps the rest in the same pieces', () => {
    const typed = typedSegments(COMMAND, 20);
    expect(typed.map((part) => part.shown + part.hidden).join('')).toBe(COMMAND);
    expect(typed.map((part) => part.shown).join('')).toBe(COMMAND.slice(0, 20));
    expect(typedSegments(COMMAND, 0).every((part) => part.shown === '')).toBe(true);
    expect(typedSegments(COMMAND, COMMAND.length).every((part) => part.hidden === '')).toBe(true);
  });

  it('shows a follow-up line when it is typed, or whenever typing is not under way', () => {
    expect(lineVisible('unix', 'on', 1, 0)).toBe(true);
    expect(lineVisible('unix', 'on', 1, 1)).toBe(false);
    expect(lineVisible('unix', 'done', 0, 2)).toBe(true);
    expect(lineVisible('unix', 'skip', 0, 2)).toBe(true);
    expect(lineVisible('windows', 'on', 0, 2)).toBe(true);
  });

  it('overlays only the first shell, only while it types', () => {
    expect(overlayShown('unix', 'unix', 'on')).toBe(true);
    expect(overlayShown('unix', 'windows', 'on')).toBe(false);
    expect(overlayShown('windows', 'windows', 'on')).toBe(false);
    expect(overlayShown('unix', 'unix', 'after')).toBe(false);
    expect(typingAfterChoice('on')).toBe('after');
    expect(typingAfterChoice('done')).toBe('done');
  });

  it('copies the whole command and says whether it could', async () => {
    const write = vi.fn(() => Promise.resolve());
    expect(await copyText(write, COMMAND)).toBe('copied');
    expect(write).toHaveBeenCalledWith(COMMAND);
    expect(await copyText(() => Promise.reject(new Error('refused')), COMMAND)).toBe('failed');
  });

  it('words the note and the button for each state', () => {
    expect(noteFor('idle')).toContain(RELEASE_CAVEAT);
    expect(noteFor('copied')).toContain('clipboard');
    expect(noteFor('failed')).toContain('by hand');
    expect(copyLabel('copied')).toBe('Copied');
    expect(copyLabel('idle')).toBe('Copy');
    expect(commandOf('unix')).toBe(COMMAND);
    expect(commandOf('windows')).toContain('curl.exe');
  });
});
