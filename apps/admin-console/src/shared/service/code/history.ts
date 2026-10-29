export interface Snapshot {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

interface Place {
  start: number;
  end: number;
}

// One change to a text: what was at `from` and what replaced it, and where the
// selection stood before and after. Undo and redo cost the size of the change,
// never of the text.
export interface Patch {
  from: number;
  removed: string;
  inserted: string;
  before: Place;
  after: Place;
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
  // Where the caret stood after the last edit of the burst.
  caret: number;
}

// An entry is the patches of one undo step, in the order they were made.
type Entry = readonly Patch[];

// `past` holds the steps an undo takes back, oldest first; `future` the steps
// a redo makes again, the next one last.
export interface History {
  past: readonly Entry[];
  future: readonly Entry[];
  burst: Burst | null;
}

export const HISTORY_MAX_ENTRIES = 200;
// The characters the patches of all the steps hold together. A step costs
// what it changed, so a 128 KiB stylesheet keeps its depth under typing.
export const HISTORY_MAX_CHARS = 1_000_000;
// A burst of typing is cut into steps of at most this many edits.
export const HISTORY_MAX_BURST = 500;
// A pause longer than this ends a burst of typing.
export const HISTORY_PAUSE_MS = 1000;

// An edit that is always a step of its own: a Tab, a paste, a composition.
export const DISCRETE: HistoryEdit = { kind: 'discrete', data: '' };

export const EMPTY_HISTORY: History = { past: [], future: [], burst: null };

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

// The one patch that turns `before` into `after`, or null when the text is
// the same. It is found from both ends, so its cost is the length of the text
// once and its size the size of the change.
export function patchBetween(before: Snapshot, after: Snapshot): Patch | null {
  const was = before.value;
  const now = after.value;
  const shortest = Math.min(was.length, now.length);
  let from = 0;
  while (from < shortest && was.charCodeAt(from) === now.charCodeAt(from)) from += 1;
  let wasEnd = was.length;
  let nowEnd = now.length;
  while (
    wasEnd > from &&
    nowEnd > from &&
    was.charCodeAt(wasEnd - 1) === now.charCodeAt(nowEnd - 1)
  ) {
    wasEnd -= 1;
    nowEnd -= 1;
  }
  if (wasEnd === from && nowEnd === from) return null;
  return {
    from,
    removed: was.slice(from, wasEnd),
    inserted: now.slice(from, nowEnd),
    before: { start: before.selectionStart, end: before.selectionEnd },
    after: { start: after.selectionStart, end: after.selectionEnd },
  };
}

function patched(text: string, patch: Patch, direction: 'undo' | 'redo'): string | null {
  const here = direction === 'undo' ? patch.inserted : patch.removed;
  const there = direction === 'undo' ? patch.removed : patch.inserted;
  if (!text.startsWith(here, patch.from)) return null;
  return text.slice(0, patch.from) + there + text.slice(patch.from + here.length);
}

function weight(entries: readonly Entry[]): number {
  return entries.reduce(
    (sum, entry) =>
      sum + entry.reduce((inner, patch) => inner + patch.removed.length + patch.inserted.length, 0),
    0,
  );
}

function capped(entries: readonly Entry[]): readonly Entry[] {
  let first = 0;
  let chars = weight(entries);
  while (
    entries.length - first > 1 &&
    (entries.length - first > HISTORY_MAX_ENTRIES || chars > HISTORY_MAX_CHARS)
  ) {
    chars -= weight([entries[first] ?? []]);
    first += 1;
  }
  return first === 0 ? entries : entries.slice(first);
}

function joins(history: History, before: Snapshot, edit: HistoryEdit, now: number): boolean {
  const { burst } = history;
  const last = history.past[history.past.length - 1];
  return (
    edit.kind !== 'discrete' &&
    burst !== null &&
    last !== undefined &&
    last.length < HISTORY_MAX_BURST &&
    burst.kind === edit.kind &&
    !burst.boundary &&
    now - burst.at <= HISTORY_PAUSE_MS &&
    before.selectionStart === before.selectionEnd &&
    before.selectionStart === burst.caret
  );
}

// A text changed from outside (a restored draft, the other admin's version)
// has no history: stepping back would put back what was never typed here.
export function reconciled(history: History, seen: string, now: string): History {
  return seen === now ? history : EMPTY_HISTORY;
}

// Notes an edit that took the text from `before` to `after`. An edit that
// changed nothing is not noted; a new one ends the redo line.
export function committed(
  history: History,
  seen: string,
  before: Snapshot,
  after: Snapshot,
  edit: HistoryEdit,
  now: number,
): History {
  const base = reconciled(history, seen, before.value);
  const patch = patchBetween(before, after);
  if (patch === null) return base;
  const burst: Burst | null =
    edit.kind === 'discrete'
      ? null
      : {
          kind: edit.kind,
          at: now,
          boundary: /\s/u.test(edit.data.slice(-1)) || edit.data.includes('\n'),
          caret: after.selectionEnd,
        };
  const last = base.past[base.past.length - 1];
  if (last !== undefined && joins(base, before, edit, now)) {
    return { past: [...base.past.slice(0, -1), [...last, patch]], future: [], burst };
  }
  return { past: capped([...base.past, [patch]]), future: [], burst };
}

// An edit heard before it was made, waiting for the text it made.
export interface Pending {
  before: Snapshot;
  edit: HistoryEdit;
}

// What the history is once the text changed. A change that was not heard
// coming (the text was set from code, filled in by a tool) cannot be told
// from a patch, so it ends the history; one made while an input method is
// composing waits for the composition to end.
export function changed(
  history: History,
  seen: string,
  pending: Pending | null,
  after: Snapshot,
  composing: boolean,
  now: number,
): History {
  if (pending !== null) return committed(history, seen, pending.before, after, pending.edit, now);
  return composing ? history : EMPTY_HISTORY;
}

export interface Stepped {
  history: History;
  // The state to show, or null when there is nowhere to go.
  to: Snapshot | null;
}

// An undo or a redo of the text `current`. A step that does not fit the text
// (it was changed some way the history did not see) ends the history instead.
export function travelled(
  history: History,
  seen: string,
  current: string,
  direction: 'undo' | 'redo',
): Stepped {
  const base = reconciled(history, seen, current);
  const stack = direction === 'undo' ? base.past : base.future;
  const entry = stack[stack.length - 1];
  if (entry === undefined) return { history: base, to: null };
  const order = direction === 'undo' ? [...entry].reverse() : entry;
  let text: string | null = current;
  for (const patch of order) {
    text = text === null ? null : patched(text, patch, direction);
  }
  const edge = direction === 'undo' ? entry[0] : entry[entry.length - 1];
  if (text === null || edge === undefined) return { history: EMPTY_HISTORY, to: null };
  const place = direction === 'undo' ? edge.before : edge.after;
  return {
    to: { value: text, selectionStart: place.start, selectionEnd: place.end },
    history:
      direction === 'undo'
        ? { past: base.past.slice(0, -1), future: capped([...base.future, entry]), burst: null }
        : { past: capped([...base.past, entry]), future: base.future.slice(0, -1), burst: null },
  };
}

export type InputIntent = 'undo' | 'redo' | 'ignore' | HistoryEdit;

// What a `beforeinput` of this type means for the history. A field that is
// read-only or being composed into takes no part.
export function inputIntent(inputType: string, data: string | null, deaf = false): InputIntent {
  if (deaf) return 'ignore';
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
  return DISCRETE;
}
