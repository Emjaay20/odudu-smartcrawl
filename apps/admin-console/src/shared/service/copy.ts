// A role or scope a copy left out because the caller could not give it, and why.
export interface LeftOut {
  name: string;
  why: string;
}

// A copy missing some of its parts stays on the page, with where to finish it.
export interface PartialCopy {
  text: string;
  href: string;
  name: string;
}

// Create is held while a write is under way, the source is being read, or
// the caller is not yet known.
export function copyBusy(busy: boolean, source: string, caller: unknown): boolean {
  return busy || source === 'loading' || caller === undefined;
}

// A copy part-made stays on the page, so another is held back as well.
export function copyBlocked(
  busy: boolean,
  partial: PartialCopy | null,
  source: string,
  caller: unknown,
): boolean {
  return partial !== null || copyBusy(busy, source, caller);
}

// An edited description wins, even an emptied one; otherwise the source's.
export function copiedDescription(edited: string | null, source: string | null): string {
  return edited ?? source ?? '';
}
