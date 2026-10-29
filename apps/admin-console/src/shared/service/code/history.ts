export interface Snapshot {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

// The state of a text field as it stands, from the field itself.
export function snapshotOf(field: {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}): Snapshot {
  return {
    value: field.value,
    selectionStart: field.selectionStart,
    selectionEnd: field.selectionEnd,
  };
}

// What an edit is, for deciding whether it joins the one before: typing and
// deleting run in bursts; anything else (a Tab, a paste, a cut) is its own
// entry.
export type EditKind = 'insert' | 'delete' | 'discrete';

export interface HistoryEdit {
  kind: EditKind;
  // What an insert put in, so a space or a newline can end the burst.
  data: string;
}

interface Burst {
  kind: 'insert' | 'delete';
  at: number;
  // The last thing typed was whitespace: the next character starts an entry.
  boundary: boolean;
}

// `past` holds the states an undo returns to, oldest first; `future` the
// ones a redo returns to, the next one last.
export interface History {
  past: readonly Snapshot[];
  future: readonly Snapshot[];
  burst: Burst | null;
}

export const HISTORY_MAX_ENTRIES = 200;
// Each entry holds a whole text, and a stylesheet may be 128 KiB, so the
// entries together are bounded by size as well.
export const HISTORY_MAX_CHARS = 1_000_000;
// A pause longer than this ends a burst of typing.
export const HISTORY_PAUSE_MS = 1000;

// An edit that is always an entry of its own: a Tab, a paste, a composition.
export const DISCRETE: HistoryEdit = { kind: 'discrete', data: '' };

export const EMPTY_HISTORY: History = { past: [], future: [], burst: null };

function capped(entries: readonly Snapshot[]): readonly Snapshot[] {
  let first = 0;
  let chars = entries.reduce((sum, entry) => sum + entry.value.length, 0);
  while (
    entries.length - first > 1 &&
    (entries.length - first > HISTORY_MAX_ENTRIES || chars > HISTORY_MAX_CHARS)
  ) {
    chars -= entries[first]?.value.length ?? 0;
    first += 1;
  }
  return first === 0 ? entries : entries.slice(first);
}

function joins(history: History, edit: HistoryEdit, now: number): boolean {
  const { burst } = history;
  return (
    edit.kind !== 'discrete' &&
    burst !== null &&
    burst.kind === edit.kind &&
    !burst.boundary &&
    now - burst.at <= HISTORY_PAUSE_MS &&
    history.past.length > 0
  );
}

// Notes an edit about to be made to the text in state `before`. A new edit
// ends the redo line.
export function recorded(
  history: History,
  before: Snapshot,
  edit: HistoryEdit,
  now: number,
): History {
  const burst: Burst | null =
    edit.kind === 'discrete'
      ? null
      : {
          kind: edit.kind,
          at: now,
          boundary: /\s/u.test(edit.data.slice(-1)) || edit.data.includes('\n'),
        };
  return {
    past: joins(history, edit, now) ? history.past : capped([...history.past, before]),
    future: [],
    burst,
  };
}

export interface Travel {
  history: History;
  // The state to show.
  to: Snapshot;
}

// One step back, from the state `current`; null at the start.
export function undone(history: History, current: Snapshot): Travel | null {
  const to = history.past[history.past.length - 1];
  if (to === undefined) return null;
  return {
    to,
    history: {
      past: history.past.slice(0, -1),
      future: capped([...history.future, current]),
      burst: null,
    },
  };
}

// One step forward, from the state `current`; null at the end.
export function redone(history: History, current: Snapshot): Travel | null {
  const to = history.future[history.future.length - 1];
  if (to === undefined) return null;
  return {
    to,
    history: {
      past: capped([...history.past, current]),
      future: history.future.slice(0, -1),
      burst: null,
    },
  };
}

// A text changed from outside (a restored draft, the other admin's version)
// has no history: stepping back would put back what was never typed here.
export function reconciled(history: History, seen: string, now: string): History {
  return seen === now ? history : EMPTY_HISTORY;
}

// Notes an edit about to be made, forgetting what came before if the text was
// changed from outside since.
export function noted(
  history: History,
  seen: string,
  before: Snapshot,
  edit: HistoryEdit,
  now: number,
): History {
  return recorded(reconciled(history, seen, before.value), before, edit, now);
}

export interface Stepped {
  history: History;
  // The state to show, or null when there is nowhere to go.
  to: Snapshot | null;
}

// An undo or a redo from the state `current`.
export function travelled(
  history: History,
  seen: string,
  current: Snapshot,
  direction: 'undo' | 'redo',
): Stepped {
  const base = reconciled(history, seen, current.value);
  const step = direction === 'undo' ? undone(base, current) : redone(base, current);
  return step === null ? { history: base, to: null } : { history: step.history, to: step.to };
}

export type InputIntent = 'undo' | 'redo' | 'ignore' | HistoryEdit;

// What a `beforeinput` of this type means for the history.
export function inputIntent(inputType: string, data: string | null): InputIntent {
  if (inputType === 'historyUndo') return 'undo';
  if (inputType === 'historyRedo') return 'redo';
  if (inputType.includes('Composition')) return 'ignore';
  if (
    inputType === 'insertText' ||
    inputType === 'insertLineBreak' ||
    inputType === 'insertParagraph'
  ) {
    return { kind: 'insert', data: data ?? '\n' };
  }
  if (
    inputType.startsWith('delete') &&
    inputType !== 'deleteByCut' &&
    inputType !== 'deleteByDrag'
  ) {
    return { kind: 'delete', data: '' };
  }
  return { kind: 'discrete', data: '' };
}
