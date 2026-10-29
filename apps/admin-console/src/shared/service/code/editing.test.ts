import { describe, expect, it } from 'vitest';
import { indentEdit, keyStep, type KeyPress, type TextEdit } from '#/shared/service/code';

function applyEdit(value: string, edit: TextEdit): string {
  return value.slice(0, edit.from) + edit.text + value.slice(edit.to);
}

const press = (key: string, more: Partial<KeyPress> = {}): KeyPress => ({
  key,
  shiftKey: false,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  ...more,
});

describe('keyStep', () => {
  it('indents on Tab and outdents on Shift+Tab', () => {
    expect(keyStep(press('Tab'), false)).toEqual({ action: 'indent', escaped: false });
    expect(keyStep(press('Tab', { shiftKey: true }), false)).toEqual({
      action: 'outdent',
      escaped: false,
    });
  });

  it('lets the next Tab leave after Escape, and only that one', () => {
    const escaped = keyStep(press('Escape'), false);
    expect(escaped).toEqual({ action: 'none', escaped: true });
    expect(keyStep(press('Tab'), escaped.escaped)).toEqual({ action: 'none', escaped: false });
    expect(keyStep(press('Tab'), false).action).toBe('indent');
  });

  it('keeps the escape while a modifier is pressed for Shift+Tab', () => {
    expect(keyStep(press('Shift', { shiftKey: true }), true).escaped).toBe(true);
    expect(keyStep(press('Tab', { shiftKey: true }), true)).toEqual({
      action: 'none',
      escaped: false,
    });
  });

  it('forgets the escape on any other key', () => {
    expect(keyStep(press('a'), true)).toEqual({ action: 'none', escaped: false });
  });

  it('leaves Ctrl, Cmd and Alt with Tab to the browser', () => {
    for (const more of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }]) {
      expect(keyStep(press('Tab', more), false).action).toBe('none');
    }
  });
});

function indented(value: string, start: number, end: number, outdent = false) {
  const edit = indentEdit(value, start, end, outdent);
  return edit === null
    ? null
    : { value: applyEdit(value, edit), selection: [edit.selectionStart, edit.selectionEnd] };
}

describe('indentEdit', () => {
  it('inserts an indent at the caret', () => {
    expect(indented('a: b', 2, 2)).toEqual({ value: 'a:   b', selection: [4, 4] });
  });

  it('replaces a selection within one line by an indent', () => {
    expect(indented('abcdef', 1, 4)).toEqual({ value: 'a  ef', selection: [3, 3] });
  });

  it('indents every touched line and keeps the selection over them', () => {
    expect(indented('a\nb\nc', 0, 5)).toEqual({ value: '  a\n  b\n  c', selection: [0, 11] });
    expect(indented('a\nb\nc', 2, 4)).toEqual({ value: 'a\n  b\nc', selection: [2, 6] });
  });

  it('skips empty lines and a line the selection only reaches the start of', () => {
    expect(indented('a\n\nb\nc', 0, 5)).toEqual({ value: '  a\n\n  b\nc', selection: [0, 9] });
    expect(indented('a\nb\nc', 0, 4)).toEqual({ value: '  a\n  b\nc', selection: [0, 8] });
  });

  it('moves a selection that starts inside a line along with its text', () => {
    expect(indented('ab\ncd', 1, 4)).toEqual({ value: '  ab\n  cd', selection: [3, 8] });
  });
});

describe('indentEdit outdenting', () => {
  it('takes two spaces, one, or a tab from the line of the caret', () => {
    expect(indented('    a', 5, 5, true)).toEqual({ value: '  a', selection: [3, 3] });
    expect(indented(' a', 2, 2, true)).toEqual({ value: 'a', selection: [1, 1] });
    expect(indented('\ta', 2, 2, true)).toEqual({ value: 'a', selection: [1, 1] });
  });

  it('clamps a caret inside the part removed', () => {
    expect(indented('  a', 1, 1, true)).toEqual({ value: 'a', selection: [0, 0] });
  });

  it('outdents each touched line', () => {
    expect(indented('  a\n    b\nc', 0, 11, true)).toEqual({
      value: 'a\n  b\nc',
      selection: [0, 7],
    });
  });

  it('is nothing when nothing leads the lines', () => {
    expect(indentEdit('a\nb', 0, 3, true)).toBeNull();
  });
});
