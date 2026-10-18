import { globSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../docs/markdown.js';

const DIGEST = /@sha256:[0-9a-f]{64}$/;
const TAG_BESIDE_DIGEST = /^[^@\s]+:[^@:/\s]+@sha256:[0-9a-f]{64}$/;

interface Reference {
  readonly file: string;
  readonly line: number;
  readonly image: string;
}

function dockerfileReferences(file: string, text: string): Reference[] {
  const stages = new Set<string>();
  const found: Reference[] = [];
  text.split('\n').forEach((raw, index) => {
    const match = /^\s*FROM\s+(?:--\S+\s+)*(\S+)(?:\s+AS\s+(\S+))?/i.exec(raw);
    if (match?.[1] === undefined) return;
    if (!stages.has(match[1].toLowerCase())) {
      found.push({ file, line: index + 1, image: match[1] });
    }
    if (match[2] !== undefined) stages.add(match[2].toLowerCase());
  });
  return found;
}

function composeReferences(file: string, text: string): Reference[] {
  const found: Reference[] = [];
  text.split('\n').forEach((raw, index) => {
    const match = /^\s*image:\s*['"]?([^\s'"#]+)/.exec(raw);
    if (match?.[1] !== undefined) found.push({ file, line: index + 1, image: match[1] });
  });
  return found;
}

function imageReferences(file: string, text: string): Reference[] {
  return path.basename(file) === 'Dockerfile'
    ? dockerfileReferences(file, text)
    : composeReferences(file, text);
}

function describeReference(ref: Reference): string {
  return `${ref.file}:${String(ref.line)} ${ref.image}`;
}

function unpinned(refs: readonly Reference[]): string[] {
  return refs.filter((ref) => !DIGEST.test(ref.image)).map(describeReference);
}

function withoutTag(refs: readonly Reference[]): string[] {
  return refs.filter((ref) => !TAG_BESIDE_DIGEST.test(ref.image)).map(describeReference);
}

function shippedReferences(): Reference[] {
  const files = globSync('{infra,examples,quickstart}/**/{Dockerfile,*.yaml,*.yml}', {
    cwd: REPO_ROOT,
    exclude: (name) => name === 'node_modules',
  });
  return files.flatMap((file) =>
    imageReferences(file, readFileSync(path.join(REPO_ROOT, file), 'utf8')),
  );
}

describe('base images', () => {
  it('pins every FROM and image: by digest', () => {
    const refs = shippedReferences();
    expect(refs.length).toBeGreaterThan(0);
    expect(unpinned(refs)).toEqual([]);
  });

  it('names a tag beside the digest', () => {
    expect(withoutTag(shippedReferences())).toEqual([]);
  });

  it('treats a stage alias as a stage, not an image', () => {
    const refs = imageReferences(
      'Dockerfile',
      'FROM node:24 AS base\nFROM base AS build\nFROM --platform=linux/amd64 node:24 AS run\n',
    );
    expect(refs.map((ref) => ref.image)).toEqual(['node:24', 'node:24']);
  });

  it('catches an unpinned fixture', () => {
    const file = 'tests/lint/fixtures/unpinned-compose.yaml';
    const refs = imageReferences(file, readFileSync(path.join(REPO_ROOT, file), 'utf8'));
    expect(unpinned(refs)).toEqual([`${file}:3 postgres:17-alpine`]);
  });
});
