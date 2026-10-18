import { globSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../docs/markdown.js';

// An image reference is read from: a Dockerfile's FROM, COPY --from and
// RUN --mount from=; a compose or workflow `image:` or scalar `container:`;
// a workflow `uses: docker://`; and a Testcontainers constructor given a
// string literal. It cannot see a value on the line after its key, a name
// held in a variable, a `docker run` or `docker pull` inside a script, or a
// Testcontainers image passed as anything but a literal.

const DIGEST = /@sha256:[0-9a-f]{64}$/;
const TAG_BESIDE_DIGEST = /^[^@\s]+:[^@:/\s]+@sha256:[0-9a-f]{64}$/;
// The names Dependabot's docker ecosystem reads as Dockerfiles.
const DOCKERFILE_NAME = /dockerfile|containerfile/i;

interface Reference {
  readonly file: string;
  readonly line: number;
  readonly image: string;
}

function logicalLines(text: string): { line: number; text: string }[] {
  const out: { line: number; text: string }[] = [];
  let pending: { line: number; text: string } | undefined;
  text.split('\n').forEach((raw, index) => {
    if (pending === undefined && /^\s*#/.test(raw)) return;
    const joined = (pending?.text ?? '') + ' ' + raw.replace(/\\\s*$/, '');
    const start = pending?.line ?? index + 1;
    if (/\\\s*$/.test(raw)) {
      pending = { line: start, text: joined };
    } else {
      pending = undefined;
      out.push({ line: start, text: joined });
    }
  });
  return out;
}

function dockerfileReferences(file: string, text: string): Reference[] {
  const stages = new Set<string>(['scratch']);
  const found: Reference[] = [];
  const add = (line: number, image: string): void => {
    if (!stages.has(image.toLowerCase()) && !/^\d+$/.test(image)) {
      found.push({ file, line, image });
    }
  };
  for (const { line, text: logical } of logicalLines(text)) {
    const from = /^\s*FROM\s+(?:--\S+\s+)*(\S+)(?:\s+AS\s+(\S+))?/i.exec(logical);
    if (from?.[1] !== undefined) {
      add(line, from[1]);
      if (from[2] !== undefined) stages.add(from[2].toLowerCase());
      continue;
    }
    const copy = /^\s*COPY\s+(?:--\S+\s+)*?--from=(\S+)/i.exec(logical);
    if (copy?.[1] !== undefined) add(line, copy[1]);
    const mount = /^\s*RUN\s.*?--mount=\S*?\bfrom=([^,\s]+)/i.exec(logical);
    if (mount?.[1] !== undefined) add(line, mount[1]);
  }
  return found;
}

const YAML_PATTERNS: readonly RegExp[] = [
  /^\s*(?:-\s+)?image:\s*['"]?([^\s'"#]+)/,
  /^\s*(?:-\s+)?container:\s*['"]?([^\s'"#]+)/,
  /^\s*(?:-\s+)?uses:\s*['"]?docker:\/\/([^\s'"#]+)/,
];

function yamlReferences(file: string, text: string): Reference[] {
  const found: Reference[] = [];
  text.split('\n').forEach((raw, index) => {
    for (const pattern of YAML_PATTERNS) {
      const match = pattern.exec(raw);
      if (match?.[1] !== undefined) found.push({ file, line: index + 1, image: match[1] });
    }
  });
  return found;
}

function testcontainerReferences(file: string, text: string): Reference[] {
  const pattern = /new\s+\w*Container\(\s*['"`]([^'"`]+)['"`]/g;
  return [...text.matchAll(pattern)].map((match) => ({
    file,
    line: text.slice(0, match.index).split('\n').length,
    image: match[1] ?? '',
  }));
}

function imageReferences(file: string, text: string): Reference[] {
  if (file.endsWith('.ts')) return testcontainerReferences(file, text);
  return DOCKERFILE_NAME.test(path.basename(file))
    ? dockerfileReferences(file, text)
    : yamlReferences(file, text);
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
  const skip = (name: string): boolean => name === 'node_modules' || name === 'dist';
  const files = [
    ...globSync('{infra,examples,quickstart}/**/*', { cwd: REPO_ROOT, exclude: skip }).filter(
      (file) => DOCKERFILE_NAME.test(path.basename(file)) || /\.ya?ml$/.test(file),
    ),
    ...globSync('.github/**/*.{yml,yaml}', { cwd: REPO_ROOT }),
    ...globSync('{packages,apps}/**/*.ts', { cwd: REPO_ROOT, exclude: skip }),
  ];
  return files.flatMap((file) =>
    imageReferences(file, readFileSync(path.join(REPO_ROOT, file), 'utf8')),
  );
}

const IMAGES = (refs: readonly Reference[]): string[] => refs.map((ref) => ref.image);

describe('base images', () => {
  it('pins every image reference by digest', () => {
    const refs = shippedReferences();
    expect(refs.length).toBeGreaterThan(0);
    expect(unpinned(refs)).toEqual([]);
  });

  it('names a tag beside the digest', () => {
    expect(withoutTag(shippedReferences())).toEqual([]);
  });

  it('reads workflows and Testcontainers constructors', () => {
    const files = new Set(shippedReferences().map((ref) => ref.file));
    expect([...files].some((file) => file.endsWith('postgres.ts'))).toBe(true);
    expect([...files].some((file) => file.endsWith('smtp.int.test.ts'))).toBe(true);
  });

  it('treats a stage alias, a numbered stage and scratch as stages', () => {
    const refs = imageReferences(
      'Dockerfile',
      'FROM node:24 AS base\nFROM base AS build\nFROM scratch\nFROM --platform=linux/amd64 node:24 AS run\nCOPY --from=build /a /b\nCOPY --from=0 /a /b\n',
    );
    expect(IMAGES(refs)).toEqual(['node:24', 'node:24']);
  });

  it('flags unpinned Dockerfile forms', () => {
    const text = [
      'FROM node:24 AS a',
      'FROM \\',
      '  --platform=linux/amd64 \\',
      '  alpine:3 AS b',
      'COPY --chown=x:y --from=busybox:1 /a /b',
      'RUN --mount=type=bind,from=nginx:1,target=/t true',
      'FROM ${BASE}',
    ].join('\n');
    expect(unpinned(imageReferences('Dockerfile.dev', text))).toEqual([
      'Dockerfile.dev:1 node:24',
      'Dockerfile.dev:2 alpine:3',
      'Dockerfile.dev:5 busybox:1',
      'Dockerfile.dev:6 nginx:1',
      'Dockerfile.dev:7 ${BASE}',
    ]);
  });

  it('flags unpinned workflow forms', () => {
    const text = [
      'jobs:',
      '  a:',
      '    container: node:24',
      '    services:',
      '      db:',
      '        image: postgres:17',
      '    steps:',
      '      - uses: docker://alpine:3',
      '  b:',
      '    container:',
      '      image: ghcr.io/x/y:1',
      '      options: --user 1',
    ].join('\n');
    expect(unpinned(imageReferences('.github/workflows/x.yml', text))).toEqual([
      '.github/workflows/x.yml:3 node:24',
      '.github/workflows/x.yml:6 postgres:17',
      '.github/workflows/x.yml:8 alpine:3',
      '.github/workflows/x.yml:11 ghcr.io/x/y:1',
    ]);
  });

  it('flags an unpinned Testcontainers literal', () => {
    const text =
      "x = new GenericContainer('axllent/mailpit')\ny = new PostgreSqlContainer('postgres:17')";
    expect(unpinned(imageReferences('a.ts', text))).toEqual([
      'a.ts:1 axllent/mailpit',
      'a.ts:2 postgres:17',
    ]);
  });

  it('catches an unpinned compose fixture', () => {
    const file = 'tests/lint/fixtures/unpinned-compose.yaml';
    const refs = imageReferences(file, readFileSync(path.join(REPO_ROOT, file), 'utf8'));
    expect(unpinned(refs)).toEqual([`${file}:3 postgres:17-alpine`]);
  });
});
