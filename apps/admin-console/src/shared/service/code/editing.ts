export const INDENT = '  ';

export const TAB_LEAD = 'Tab indents. To move on, press';
export const TAB_THEN = 'then';

export interface KeyPress {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}

export interface KeyStep {
  action: 'indent' | 'outdent' | 'none';
  // Whether Escape was the last key, so the next Tab leaves the field.
  escaped: boolean;
}

const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta']);

// Tab in a code field indents, so it would trap the keyboard. Escape lets go:
// the Tab that follows moves on, as it would from any other field.
export function keyStep(press: KeyPress, escaped: boolean): KeyStep {
  const bare = !press.ctrlKey && !press.metaKey && !press.altKey;
  if (press.key === 'Escape' && bare) return { action: 'none', escaped: true };
  if (MODIFIERS.has(press.key)) return { action: 'none', escaped };
  if (press.key !== 'Tab' || !bare || escaped) return { action: 'none', escaped: false };
  return { action: press.shiftKey ? 'outdent' : 'indent', escaped: false };
}

export interface TextEdit {
  // The range replaced, and what replaces it.
  from: number;
  to: number;
  text: string;
  // Where the selection stands afterwards, in the new text.
  selectionStart: number;
  selectionEnd: number;
}

function lineStartOf(value: string, at: number): number {
  return value.lastIndexOf('\n', at - 1) + 1;
}

function lineEndOf(value: string, at: number): number {
  const end = value.indexOf('\n', at);
  return end === -1 ? value.length : end;
}

interface Line {
  start: number;
  text: string;
}

// The lines a selection touches. A selection that ends at the start of a
// line does not touch that line.
function touched(value: string, start: number, end: number): { from: number; lines: Line[] } {
  const from = lineStartOf(value, start);
  const last = end > start && value[end - 1] === '\n' ? end - 1 : end;
  const to = lineEndOf(value, last);
  const lines: Line[] = [];
  let at = from;
  for (const text of value.slice(from, to).split('\n')) {
    lines.push({ start: at, text });
    at += text.length + 1;
  }
  return { from, lines };
}

function leadingRemovable(text: string): number {
  if (text.startsWith('\t')) return 1;
  let count = 0;
  while (count < INDENT.length && text[count] === ' ') count += 1;
  return count;
}

function indentLines(value: string, start: number, end: number): TextEdit {
  const { from, lines } = touched(value, start, end);
  const added = lines.map((line) => (line.text === '' ? 0 : INDENT.length));
  const shift = (position: number): number =>
    lines.reduce(
      (sum, line, index) => (line.start < position ? sum + (added[index] ?? 0) : sum),
      0,
    );
  return {
    from,
    to: from + lines.map((line) => line.text).join('\n').length,
    text: lines
      .map((line, index) => (added[index] === 0 ? line.text : INDENT + line.text))
      .join('\n'),
    selectionStart: start + shift(start),
    selectionEnd: end + shift(end),
  };
}

function outdentLines(value: string, start: number, end: number): TextEdit | null {
  const { from, lines } = touched(value, start, end);
  const removed = lines.map((line) => leadingRemovable(line.text));
  if (removed.every((count) => count === 0)) return null;
  const shift = (position: number): number =>
    lines.reduce(
      (sum, line, index) =>
        line.start < position ? sum - Math.min(removed[index] ?? 0, position - line.start) : sum,
      0,
    );
  return {
    from,
    to: from + lines.map((line) => line.text).join('\n').length,
    text: lines.map((line, index) => line.text.slice(removed[index] ?? 0)).join('\n'),
    selectionStart: start + shift(start),
    selectionEnd: end + shift(end),
  };
}

// What Tab or Shift+Tab does to the text, as an edit; null when it changes
// nothing. Tab over part of one line replaces the selection with an indent;
// over several lines it indents each of them.
export function indentEdit(
  value: string,
  start: number,
  end: number,
  outdent: boolean,
): TextEdit | null {
  if (outdent) return outdentLines(value, start, end);
  if (!value.slice(start, end).includes('\n')) {
    const caret = start + INDENT.length;
    return { from: start, to: end, text: INDENT, selectionStart: caret, selectionEnd: caret };
  }
  return indentLines(value, start, end);
}

// The text with the edit made, for a browser that cannot insert at a selection.
export function applyEdit(value: string, edit: TextEdit): string {
  return value.slice(0, edit.from) + edit.text + value.slice(edit.to);
}
