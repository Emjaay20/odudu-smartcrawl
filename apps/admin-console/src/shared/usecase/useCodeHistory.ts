import { useEffect, useRef, type RefObject } from 'react';
import { useLatest } from '#/shared/repository/useLatest';
import {
  DISCRETE,
  EMPTY_HISTORY,
  historyKey,
  inputIntent,
  noted,
  reconciled,
  recorded,
  snapshotOf,
  travelled,
  type History,
  type KeyPress,
  type Snapshot,
  type TextEdit,
} from '#/shared/service/code';

export interface CodeHistory {
  // The field's onChange: it also keeps what the text now is.
  change: (value: string) => void;
  // Handles Cmd or Ctrl+Z and redo; true when the key was one of them.
  keyed: (press: KeyPress, event: { preventDefault: () => void }) => boolean;
  // Makes an edit as an entry of its own.
  replace: (edit: TextEdit) => void;
  composing: () => boolean;
  compositionStart: () => void;
  compositionEnd: () => void;
}

// The undo history of a code field. Every edit, typed or made by the field,
// is noted before it happens; undo and redo are heard as `beforeinput` of
// type historyUndo and historyRedo and as the keys, and put a snapshot back
// through the same onChange typing uses. The browser's own undo is not
// relied on: setting the text from code empties it.
export function useCodeHistory({
  value,
  onChange,
  readOnly,
}: {
  value: string;
  onChange: (value: string) => void;
  readOnly: boolean;
}): [RefObject<HTMLTextAreaElement | null>, CodeHistory] {
  const areaRef = useRef<HTMLTextAreaElement | null>(null);
  const history = useRef<History>(EMPTY_HISTORY);
  const seen = useRef(value);
  const composing = useRef(false);
  const started = useRef<Snapshot | null>(null);

  const change = (next: string): void => {
    seen.current = next;
    onChange(next);
  };

  const go = (area: HTMLTextAreaElement, direction: 'undo' | 'redo'): void => {
    const step = travelled(history.current, seen.current, snapshotOf(area), direction);
    history.current = step.history;
    if (step.to === null) return;
    area.value = step.to.value;
    area.setSelectionRange(step.to.selectionStart, step.to.selectionEnd);
    change(step.to.value);
  };

  const heard = (event: InputEvent): void => {
    const area = areaRef.current;
    if (area === null || readOnly || event.isComposing || composing.current) return;
    const intent = inputIntent(event.inputType, event.data);
    if (intent === 'ignore') return;
    if (intent === 'undo' || intent === 'redo') {
      event.preventDefault();
      go(area, intent);
      return;
    }
    history.current = noted(history.current, seen.current, snapshotOf(area), intent, Date.now());
  };
  const listening = useLatest(heard);
  useEffect(() => {
    const area = areaRef.current;
    if (area === null) return undefined;
    const listener = (event: InputEvent): void => {
      listening()(event);
    };
    area.addEventListener('beforeinput', listener);
    return () => {
      area.removeEventListener('beforeinput', listener);
    };
  }, [listening]);

  const controls: CodeHistory = {
    change,
    keyed: (press, event) => {
      const direction = historyKey(press);
      if (direction === null) return false;
      event.preventDefault();
      const area = areaRef.current;
      if (area !== null && !readOnly) go(area, direction);
      return true;
    },
    replace: (edit) => {
      const area = areaRef.current;
      if (area === null || (edit.from === edit.to && edit.text === '')) return;
      history.current = noted(
        history.current,
        seen.current,
        snapshotOf(area),
        DISCRETE,
        Date.now(),
      );
      area.setRangeText(edit.text, edit.from, edit.to, 'end');
      change(area.value);
      area.setSelectionRange(edit.selectionStart, edit.selectionEnd);
    },
    composing: () => composing.current,
    compositionStart: () => {
      const area = areaRef.current;
      composing.current = true;
      if (area === null) return;
      history.current = reconciled(history.current, seen.current, area.value);
      started.current = snapshotOf(area);
    },
    compositionEnd: () => {
      const area = areaRef.current;
      const before = started.current;
      started.current = null;
      if (area !== null && before !== null && area.value !== before.value) {
        history.current = recorded(history.current, before, DISCRETE, Date.now());
      }
      // The key that ends a composition is still delivered to keydown.
      setTimeout(() => {
        composing.current = false;
      }, 0);
    },
  };
  return [areaRef, controls];
}
