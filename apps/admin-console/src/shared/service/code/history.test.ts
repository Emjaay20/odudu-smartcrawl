import { describe, expect, it } from 'vitest';
import {
  EMPTY_HISTORY,
  HISTORY_MAX_CHARS,
  HISTORY_MAX_ENTRIES,
  HISTORY_PAUSE_MS,
  inputIntent,
  noted,
  reconciled,
  recorded,
  redone,
  snapshotOf,
  travelled,
  undone,
  type History,
  type HistoryEdit,
  type Snapshot,
} from '#/shared/service/code';

const at = (value: string, caret = value.length): Snapshot => ({
  value,
  selectionStart: caret,
  selectionEnd: caret,
});
const typed = (data: string): HistoryEdit => ({ kind: 'insert', data });
const erased: HistoryEdit = { kind: 'delete', data: '' };
const discrete: HistoryEdit = { kind: 'discrete', data: '' };

// Types `text` a character at a time, `gap` ms apart, from an empty text.
function typing(text: string, gap = 10, from: History = EMPTY_HISTORY, start = ''): History {
  let history = from;
  let value = start;
  Array.from(text).forEach((character, index) => {
    history = recorded(history, at(value), typed(character), index * gap);
    value += character;
  });
  return history;
}

describe('coalescing', () => {
  it('keeps a burst of typing as one entry, the state before it', () => {
    const history = typing('abc');
    expect(history.past).toEqual([at('')]);
  });

  it('starts a new entry after whitespace, so entries are words', () => {
    const history = typing('ab cd');
    expect(history.past.map((entry) => entry.value)).toEqual(['', 'ab ']);
  });

  it('starts a new entry after a newline', () => {
    const history = typing('a\nb');
    expect(history.past.map((entry) => entry.value)).toEqual(['', 'a\n']);
  });

  it('starts a new entry after a pause', () => {
    const first = typing('ab');
    const next = recorded(first, at('ab'), typed('c'), HISTORY_PAUSE_MS + 100);
    expect(next.past.map((entry) => entry.value)).toEqual(['', 'ab']);
  });

  it('keeps typing and deleting apart', () => {
    const history = recorded(typing('ab'), at('ab'), erased, 30);
    expect(history.past.map((entry) => entry.value)).toEqual(['', 'ab']);
    const more = recorded(history, at('a'), erased, 40);
    expect(more.past).toHaveLength(2);
  });

  it.each([['a Tab or any programmatic edit'], ['a paste'], ['a cut']])(
    'gives %s an entry of its own, and the next typing another',
    () => {
      let history = typing('ab');
      history = recorded(history, at('ab'), discrete, 30);
      history = recorded(history, at('ab  '), typed('c'), 40);
      expect(history.past.map((entry) => entry.value)).toEqual(['', 'ab', 'ab  ']);
    },
  );

  it('does not join a second discrete edit to the first', () => {
    let history = recorded(EMPTY_HISTORY, at('a'), discrete, 0);
    history = recorded(history, at('a  '), discrete, 5);
    expect(history.past).toHaveLength(2);
  });
});

describe('undo and redo', () => {
  it('goes back to the state before the edit and forward again', () => {
    const history = typing('abc');
    const back = undone(history, at('abc'));
    expect(back?.to).toEqual(at(''));
    expect(back?.history.future).toEqual([at('abc')]);
    const forward = back === null ? null : redone(back.history, at(''));
    expect(forward?.to).toEqual(at('abc'));
    expect(forward?.history.past).toEqual([at('')]);
  });

  it('keeps the caret each state had', () => {
    const history = recorded(EMPTY_HISTORY, at('ab', 1), discrete, 0);
    expect(undone(history, at('a  b', 3))?.to).toEqual(at('ab', 1));
  });

  it('is nothing past the start, and nothing past the end', () => {
    expect(undone(EMPTY_HISTORY, at('x'))).toBeNull();
    expect(redone(EMPTY_HISTORY, at('x'))).toBeNull();
    const back = undone(typing('a'), at('a'));
    expect(back === null ? null : undone(back.history, at(''))).toBeNull();
  });

  it('ends the redo line with a new edit', () => {
    const back = undone(typing('abc'), at('abc'));
    expect(back?.history.future).toHaveLength(1);
    const edited = recorded(back?.history ?? EMPTY_HISTORY, at(''), typed('z'), 5000);
    expect(edited.future).toEqual([]);
  });

  it('steps back through several entries in order', () => {
    let history = typing('ab cd');
    history = recorded(history, at('ab cd'), discrete, 500);
    const one = undone(history, at('ab cd  '));
    const two = one === null ? null : undone(one.history, one.to);
    const three = two === null ? null : undone(two.history, two.to);
    expect([one?.to.value, two?.to.value, three?.to.value]).toEqual(['ab cd', 'ab ', '']);
  });

  it('ends a burst, so typing after an undo is an entry of its own', () => {
    const back = undone(typing('ab'), at('ab'));
    const next = recorded(back?.history ?? EMPTY_HISTORY, at(''), typed('z'), 20);
    expect(next.past).toEqual([at('')]);
    expect(next.burst?.kind).toBe('insert');
  });
});

describe('the caps', () => {
  it('keep at most the entries it names, the newest', () => {
    let history = EMPTY_HISTORY;
    for (let index = 0; index < HISTORY_MAX_ENTRIES + 50; index += 1) {
      history = recorded(history, at(String(index)), discrete, index);
    }
    expect(history.past).toHaveLength(HISTORY_MAX_ENTRIES);
    expect(history.past[0]?.value).toBe('50');
    expect(history.past.at(-1)?.value).toBe(String(HISTORY_MAX_ENTRIES + 49));
  });

  it('keep the entries within the characters it names, but never none', () => {
    const big = 'x'.repeat(HISTORY_MAX_CHARS / 2 + 1);
    let history = recorded(EMPTY_HISTORY, at(big), discrete, 0);
    history = recorded(history, at(`${big}y`), discrete, 1);
    expect(history.past).toHaveLength(1);
    expect(history.past[0]?.value).toBe(`${big}y`);
    const huge = recorded(EMPTY_HISTORY, at('x'.repeat(HISTORY_MAX_CHARS * 2)), discrete, 0);
    expect(huge.past).toHaveLength(1);
  });

  it('bound the redo line too', () => {
    let history = EMPTY_HISTORY;
    for (let index = 0; index < HISTORY_MAX_ENTRIES + 10; index += 1) {
      history = recorded(history, at(String(index)), discrete, index);
    }
    let current = at('end');
    for (let step = 0; step < HISTORY_MAX_ENTRIES + 10; step += 1) {
      const back = undone(history, current);
      if (back === null) break;
      history = back.history;
      current = back.to;
    }
    expect(history.future.length).toBeLessThanOrEqual(HISTORY_MAX_ENTRIES);
  });
});

describe('a text changed from outside', () => {
  it('has no history', () => {
    const history = typing('abc');
    expect(reconciled(history, 'abc', 'abc')).toBe(history);
    expect(reconciled(history, 'abc', 'other')).toBe(EMPTY_HISTORY);
  });
});

describe('what a beforeinput means', () => {
  it('maps history, typing, deleting, paste and composition', () => {
    expect(inputIntent('historyUndo', null)).toBe('undo');
    expect(inputIntent('historyRedo', null)).toBe('redo');
    expect(inputIntent('insertText', 'a')).toEqual({ kind: 'insert', data: 'a' });
    expect(inputIntent('insertLineBreak', null)).toEqual({ kind: 'insert', data: '\n' });
    expect(inputIntent('deleteContentBackward', null)).toEqual({ kind: 'delete', data: '' });
    expect(inputIntent('deleteWordBackward', null)).toEqual({ kind: 'delete', data: '' });
    expect(inputIntent('insertFromPaste', 'x')).toEqual({ kind: 'discrete', data: '' });
    expect(inputIntent('deleteByCut', null)).toEqual({ kind: 'discrete', data: '' });
    expect(inputIntent('insertFromDrop', null)).toEqual({ kind: 'discrete', data: '' });
    expect(inputIntent('insertCompositionText', 'あ')).toBe('ignore');
    expect(inputIntent('deleteCompositionText', null)).toBe('ignore');
  });
});

describe('noting and travelling', () => {
  it('forgets the history of a text changed from outside before noting the next edit', () => {
    const history = typing('abc');
    const noted_ = noted(history, 'abc', at('other'), discrete, 5000);
    expect(noted_.past).toEqual([at('other')]);
    expect(noted(history, 'abc', at('abc'), discrete, 5000).past).toEqual([at(''), at('abc')]);
  });

  it('travels, and says where there is nowhere to go', () => {
    const history = typing('abc');
    const back = travelled(history, 'abc', at('abc'), 'undo');
    expect(back.to).toEqual(at(''));
    expect(travelled(back.history, '', at(''), 'redo').to).toEqual(at('abc'));
    expect(travelled(EMPTY_HISTORY, 'x', at('x'), 'undo')).toEqual({
      history: EMPTY_HISTORY,
      to: null,
    });
  });

  it('does not travel into a history of a text that is no longer this one', () => {
    const history = typing('abc');
    expect(travelled(history, 'abc', at('replaced from outside'), 'undo')).toEqual({
      history: EMPTY_HISTORY,
      to: null,
    });
  });
});

it('reads a snapshot from a field', () => {
  expect(snapshotOf({ value: 'ab', selectionStart: 1, selectionEnd: 2 })).toEqual({
    value: 'ab',
    selectionStart: 1,
    selectionEnd: 2,
  });
});
