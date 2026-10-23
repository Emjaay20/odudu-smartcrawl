import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildAdminOpenApiDocument } from '@odudu/protocol-admin/docs';
import { describe, expect, it } from 'vitest';
import { coverageOfArea, operationsOf } from './openapi-pages.ts';

// docs/phases/p4g.md records, per area of the admin API, how many of the fields
// a reader meets carry a description written for a person integrating. The
// number may rise and never fall; an area new to the API must be recorded.
const NOTES = path.resolve(import.meta.dirname, '../../../docs/phases/p4g.md');
const HEADING = '#### Admin API documentation coverage';

function baseline(): Map<string, { described: number; total: number }> {
  const text = readFileSync(NOTES, 'utf8');
  const start = text.indexOf(HEADING);
  if (start === -1) throw new Error(`${HEADING} is missing from docs/phases/p4g.md`);
  const rows = new Map<string, { described: number; total: number }>();
  for (const line of text.slice(start).split('\n').slice(1)) {
    if (line.startsWith('#')) break;
    const match = /^\|\s*`([a-z-]+)`\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|$/u.exec(line);
    if (match?.[1] !== undefined) {
      rows.set(match[1], { described: Number(match[2]), total: Number(match[3]) });
    }
  }
  return rows;
}

const doc = buildAdminOpenApiDocument();
const areas = operationsOf(doc);

describe('the descriptions in the admin API reference', () => {
  it('are recorded for every area of the API', () => {
    expect([...areas.keys()].sort()).toEqual([...baseline().keys()].sort());
  });

  it('cover at least the share of each area that was recorded', () => {
    const fell: string[] = [];
    for (const [area, recorded] of baseline()) {
      const now = coverageOfArea(areas.get(area) ?? [], doc);
      // described/total compared as a product, so fields added without a description show up
      if (now.described * recorded.total < recorded.described * now.total) {
        fell.push(
          `${area}: ${String(now.described)}/${String(now.total)} below ${String(recorded.described)}/${String(recorded.total)}`,
        );
      }
    }
    expect(fell).toEqual([]);
  });
});
