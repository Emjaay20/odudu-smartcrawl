import { createHash } from 'node:crypto';

export function staticEtag(content: Buffer): string {
  return `"${createHash('sha256').update(content).digest('base64url').slice(0, 27)}"`;
}

// RFC 9110 §13.1.2: a list, `*`, and weak validators all count, and the
// comparison is weak, so `W/"x"` matches `"x"`.
export function etagMatches(header: string | undefined, etag: string): boolean {
  if (header === undefined) return false;
  if (header.trim() === '*') return true;
  return header.split(',').some((candidate) => candidate.trim().replace(/^W\//u, '') === etag);
}
