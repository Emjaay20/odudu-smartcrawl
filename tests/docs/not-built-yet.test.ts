import { expect, it } from 'vitest';
import { loadDocument } from './markdown.js';

// The roadmap's "Next" and "Later" sections name the phase each gap waits on.
// A line outlives its phase silently: the consent-screen row once named P3a
// long after P3a shipped the screen. NEXT.md's opening sentence is where the
// finished phases are listed, so a line naming one of them is stale.
const COMPLETE = /^\*\*(.+?) are complete\b/u;
const ROADMAP = 'apps/docs/content/en/roadmap.md';

function completedPhases(): Set<string> {
  const line = loadDocument('docs/NEXT.md').lines.find((candidate) => COMPLETE.test(candidate));
  const listed = line === undefined ? undefined : COMPLETE.exec(line)?.[1];
  if (listed === undefined) throw new Error('docs/NEXT.md names no completed phases');
  return new Set(listed.match(/\bP\d+[a-z]?\b/gu) ?? []);
}

// The phase a line of "Next" or "Later" opens with, or ends with after a colon.
function owners(): { line: string; phase: string }[] {
  const text = loadDocument(ROADMAP).lines.join('\n');
  const start = text.indexOf('\n## Next');
  const end = text.indexOf('\n## Decided against');
  if (start === -1 || end === -1) throw new Error(`${ROADMAP} no longer has Next and Later`);
  return text
    .slice(start, end)
    .split('\n')
    .filter((line) => line.startsWith('- '))
    .flatMap((line) => {
      const phase =
        /^- \*\*(P\d+[a-z]?)\b/u.exec(line)?.[1] ?? /: (P\d+[a-z]?)[,.]/u.exec(line)?.[1];
      return phase === undefined ? [] : [{ line, phase }];
    });
}

it('names no finished phase as the owner of something not yet built', () => {
  const complete = completedPhases();
  expect(complete.size).toBeGreaterThan(3);
  expect(owners().length).toBeGreaterThan(15);
  const stale = owners()
    .filter(({ phase }) => complete.has(phase))
    .map(({ line }) => line.slice(0, 80));
  expect(stale).toEqual([]);
});
