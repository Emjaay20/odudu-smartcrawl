import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { JOBS, renderedHash } from './shots.ts';

const manifest: Record<string, { hash?: string }> = JSON.parse(
  readFileSync(
    path.resolve(import.meta.dirname, '../../static/server-pages/manifest.json'),
    'utf8',
  ),
) as Record<string, { hash?: string }>;

describe('the pages strip on the landing', () => {
  it('has a capture for every page the renderers produce, and no other', () => {
    expect(Object.keys(manifest).sort()).toEqual(JOBS.map((job) => job.file).sort());
  });

  it.each(JOBS.map((job) => job.file))(
    '%s still matches what the server page renderer produces',
    (file) => {
      const job = JOBS.find((candidate) => candidate.file === file);
      if (job === undefined) throw new Error(`no job named ${file}`);
      expect(
        renderedHash(job),
        `${file} changed: the server page or its stylesheet is not what the landing page shows. Run pnpm page-shots and commit the pictures.`,
      ).toBe(manifest[file]?.hash);
    },
  );

  it('hashes the same render to the same value', () => {
    const [job] = JOBS;
    if (job === undefined) throw new Error('no jobs');
    expect(renderedHash(job)).toBe(renderedHash(job));
  });
});
