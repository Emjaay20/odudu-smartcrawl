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

// An edited description wins, even an emptied one; otherwise the source's.
export function copiedDescription(edited: string | null, source: string | null): string {
  return edited ?? source ?? '';
}
