import { COMMANDS, RELEASE_CAVEAT, type Shell } from '@site/src/features/landing/service/content';

export type CopyStatus = 'idle' | 'copied' | 'failed';
// How far the hero's terminal has got: not started, typing the command, past
// it, finished, or skipped for a reader who asked for less motion.
export type Typing = 'off' | 'on' | 'after' | 'done' | 'skip';

export const COPIED_FOR_MS = 2000;
export const TYPING_SEED = 7;

const NOTES: Readonly<Record<CopyStatus, string>> = {
  idle: `${RELEASE_CAVEAT} Needs Docker with Compose v2.`,
  copied: 'Copied to your clipboard.',
  failed: 'Your browser would not copy it. Select the command and copy it by hand.',
};

export function noteFor(status: CopyStatus): string {
  return NOTES[status];
}

export function copyLabel(status: CopyStatus): 'Copied' | 'Copy' {
  return status === 'copied' ? 'Copied' : 'Copy';
}

export function commandOf(shell: Shell): string {
  return COMMANDS.find((entry) => entry.shell === shell)?.command ?? '';
}

// The command's pieces, broken after each slash so a long address wraps there.
export function segments(text: string): string[] {
  return text.split(/(?<=\/)/u);
}

export interface TypedSegment {
  readonly shown: string;
  readonly hidden: string;
}

// The same pieces with only the first `count` characters shown, so the line
// breaks are final from the first character.
export function typedSegments(text: string, count: number): TypedSegment[] {
  let left = count;
  return segments(text).map((part) => {
    const shown = part.slice(0, Math.max(left, 0));
    left -= part.length;
    return { shown, hidden: part.slice(shown.length) };
  });
}

// A follow-up line shows once it is typed, and always off the typing shell or when typing is skipped.
export function lineVisible(shell: Shell, typing: Typing, lines: number, index: number): boolean {
  return shell !== 'unix' || typing === 'skip' || typing === 'done' || index < lines;
}

// Which shell shows the typing overlay: only the first, and only while it types.
export function overlayShown(shell: Shell, chosen: Shell, typing: Typing): boolean {
  return shell === 'unix' && chosen === 'unix' && typing === 'on';
}

// Under reduced motion the terminal is simply shown, whatever had started.
export function effectiveTyping(reduced: boolean, started: Typing): Typing {
  return reduced ? 'skip' : started;
}

// Choosing another shell mid-typing lets the command stand as it is.
export function typingAfterChoice(typing: Typing): Typing {
  return typing === 'on' ? 'after' : typing;
}

export type ClipboardWrite = (text: string) => Promise<void>;

export async function copyText(write: ClipboardWrite, text: string): Promise<CopyStatus> {
  try {
    await write(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
