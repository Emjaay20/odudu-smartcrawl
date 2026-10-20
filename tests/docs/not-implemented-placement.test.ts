import { describe, expect, it } from 'vitest';
import { loadDocument } from './markdown.js';

const GUIDE = 'apps/docs/content/en/roadmap.md';
// The sections that say what is missing or refused; "Shipped" claims nothing
// is missing, so it needs no place.
const HEADINGS = ['## Next', '## Later', '## Decided against, and why'];

// A phase (P3, P4b, P13), a decision, or an ADR. Anything else is an item
// whose reader cannot tell a deliberate omission from a forgotten one, which
// is the whole failure this section exists to prevent.
const PLACED = /\bP\d+[a-z]?\b|\bdecision\b|\bADR \d+\b/u;

interface Item {
  text: string;
  lineNumber: number;
}

function itemsUnderHeading(): Item[] {
  const { lines } = loadDocument(GUIDE);
  const items: Item[] = [];
  let inside = false;
  let current: Item | null = null;
  for (const heading of HEADINGS) {
    if (!lines.some((line) => line.startsWith(heading))) {
      throw new Error(`${GUIDE} has no ${JSON.stringify(heading)} section`);
    }
  }
  for (const [index, line] of lines.entries()) {
    if (line.startsWith('## ')) {
      if (current !== null) items.push(current);
      current = null;
      inside = HEADINGS.some((heading) => line.startsWith(heading));
      continue;
    }
    if (!inside) continue;
    if (line.startsWith('- ')) {
      if (current !== null) items.push(current);
      current = { text: line, lineNumber: index + 1 };
    } else if (current !== null && /^\s+\S/u.test(line)) {
      current.text += ` ${line.trim()}`;
    }
  }
  if (current !== null) items.push(current);
  return items;
}

describe('every gap the roadmap page names has somewhere to be', () => {
  const items = itemsUnderHeading();

  it('finds the list, so a renamed heading fails rather than passing vacuously', () => {
    expect(items.length).toBeGreaterThan(20);
  });

  it('places every item against a phase, a decision or an ADR', () => {
    for (const { text, lineNumber } of items) {
      const where = `${GUIDE}:${String(lineNumber)}`;
      const summary = text.replace(/^- /u, '').replace(/\*\*/gu, '').slice(0, 60);
      expect(`${where} (${summary}): ${PLACED.test(text) ? 'placed' : 'UNPLACED'}`).toBe(
        `${where} (${summary}): placed`,
      );
    }
  });

  // An item can name a phase for one half of itself and admit the other
  // half has none — which is how "remember me" stayed unplaced inside an
  // item that says P3 twice. These are the phrasings that admission has
  // taken; the regex above cannot see any of them, because a marker being
  // present is not the same as the item being placed.
  const ADMITS_NO_PHASE =
    /unplaced|named in no phase|(?:has|have|with) no phase|no phase (?:names|for it)/iu;

  it('leaves no item admitting that part of it has nowhere to go', () => {
    for (const { text, lineNumber } of items) {
      const admission = ADMITS_NO_PHASE.exec(text);
      expect(
        `${GUIDE}:${String(lineNumber)}: ${admission === null ? 'ok' : `says "${admission[0]}"`}`,
      ).toBe(`${GUIDE}:${String(lineNumber)}: ok`);
    }
  });
});
