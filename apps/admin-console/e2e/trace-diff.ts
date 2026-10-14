// node e2e/trace-diff.ts <base.jsonl> <final.jsonl>
//
// Compares two recordings of the e2e suite, made on two builds of the
// console: which requests each test made, in what order, what each write was
// followed by, what the page kept in the browser and where focus went. Every
// difference is matched against e2e/trace-registered.json; the exit status is
// 1 while any is left unexplained.
import { readFileSync } from 'node:fs';
import { z } from 'zod';

export interface TraceEntry {
  readonly ctx: number;
  readonly kind: 'api' | 'nav';
  readonly method: string;
  readonly path: string;
  readonly query: string;
  readonly conditional: readonly string[];
  readonly contentType: string | null;
  readonly body: string | null;
  readonly status: number | 'aborted';
  readonly cache: string | null;
  readonly etag: string | null;
  // Milliseconds to the first byte and to the last, and the body's bytes on the wire.
  readonly ttfb?: number | undefined;
  readonly total?: number | undefined;
  readonly bytes?: number | undefined;
}

export interface TestTrace {
  readonly key: string;
  readonly outcome: string;
  readonly durationMs?: number | undefined;
  readonly entries: readonly TraceEntry[];
  readonly storage: readonly string[];
  readonly focus: readonly string[];
}

export type Area = 'requests' | 'reread' | 'storage' | 'focus';

export interface Difference {
  readonly test: string;
  readonly area: Area;
  readonly type: 'added' | 'removed' | 'changed' | 'moved';
  readonly base?: string;
  readonly final?: string;
  readonly after?: string;
}

export interface Comparison {
  readonly compared: number;
  readonly onlyBase: readonly string[];
  readonly onlyFinal: readonly string[];
  readonly requests: { readonly base: number; readonly final: number };
  readonly differences: readonly Difference[];
}

function target(entry: TraceEntry): string {
  return `${entry.method} ${entry.path}${entry.query === '' ? '' : `?${entry.query}`}`;
}

export function requestLine(entry: TraceEntry): string {
  const parts = [target(entry)];
  if (entry.conditional.length > 0) parts.push(`[${entry.conditional.join(',')}]`);
  if (entry.contentType !== null) parts.push(entry.contentType);
  if (entry.body !== null) parts.push(entry.body);
  parts.push('->', String(entry.status));
  if (entry.cache !== null) parts.push(`cache=${entry.cache}`);
  if (entry.etag !== null) parts.push(`etag=${entry.etag}`);
  return parts.join(' ');
}

function identity(line: string): string {
  const [method, path] = line.split(' ');
  return `${method ?? ''} ${(path ?? '').split('?')[0] ?? ''}`;
}

const isWrite = (entry: TraceEntry): boolean => entry.method !== 'GET' && entry.method !== 'HEAD';

export interface RereadSet {
  readonly write: string;
  readonly reads: readonly string[];
}

export function rereadSets(entries: readonly TraceEntry[]): RereadSet[] {
  const sets: { write: string; reads: string[] }[] = [];
  for (const entry of entries) {
    if (entry.kind !== 'api') continue;
    if (isWrite(entry)) {
      sets.push({ write: target(entry), reads: [] });
      continue;
    }
    const current = sets.at(-1);
    if (current !== undefined && !current.reads.includes(target(entry))) {
      current.reads.push(target(entry));
    }
  }
  return sets;
}

interface Hunk {
  removed: string[];
  added: string[];
}

// The lines on only one side, in the order a longest common subsequence
// leaves them, as runs between the lines both sides share.
function hunks(base: readonly string[], final: readonly string[]): Hunk[] {
  const width = final.length + 1;
  const table = new Uint32Array((base.length + 1) * width);
  for (let i = base.length - 1; i >= 0; i -= 1) {
    for (let j = final.length - 1; j >= 0; j -= 1) {
      table[i * width + j] =
        base[i] === final[j]
          ? (table[(i + 1) * width + j + 1] ?? 0) + 1
          : Math.max(table[(i + 1) * width + j] ?? 0, table[i * width + j + 1] ?? 0);
    }
  }
  const runs: Hunk[] = [];
  let run: Hunk = { removed: [], added: [] };
  const close = (): void => {
    if (run.removed.length > 0 || run.added.length > 0) runs.push(run);
    run = { removed: [], added: [] };
  };
  let i = 0;
  let j = 0;
  while (i < base.length || j < final.length) {
    if (i < base.length && j < final.length && base[i] === final[j]) {
      close();
      i += 1;
      j += 1;
    } else if (
      i < base.length &&
      (j === final.length || (table[(i + 1) * width + j] ?? 0) >= (table[i * width + j + 1] ?? 0))
    ) {
      run.removed.push(base[i] ?? '');
      i += 1;
    } else {
      run.added.push(final[j] ?? '');
      j += 1;
    }
  }
  close();
  return runs;
}

function without(list: string[], line: string): boolean {
  const at = list.indexOf(line);
  if (at === -1) return false;
  list.splice(at, 1);
  return true;
}

function sequenceDifferences(
  test: string,
  area: Area,
  base: readonly string[],
  final: readonly string[],
  pair: boolean,
): Difference[] {
  const runs = hunks(base, final);
  const moved: Difference[] = [];
  const everyAdded = runs.flatMap((run) => run.added);
  for (const run of runs) {
    for (const line of [...run.removed]) {
      if (without(everyAdded, line)) {
        without(run.removed, line);
        const home = runs.find((other) => other.added.includes(line) && other !== run) ?? run;
        without(home.added, line);
        moved.push({ test, area, type: 'moved', base: line, final: line });
      }
    }
  }
  const found: Difference[] = [];
  for (const run of runs) {
    for (const line of run.removed) {
      const at = pair ? run.added.findIndex((each) => identity(each) === identity(line)) : -1;
      if (at === -1) found.push({ test, area, type: 'removed', base: line });
      else {
        const [match] = run.added.splice(at, 1);
        found.push({ test, area, type: 'changed', base: line, final: match ?? '' });
      }
    }
    for (const line of run.added) found.push({ test, area, type: 'added', final: line });
  }
  return [...found, ...moved];
}

function rereadDifferences(
  test: string,
  base: readonly TraceEntry[],
  final: readonly TraceEntry[],
): Difference[] {
  const key = (sets: readonly RereadSet[]): Map<string, RereadSet> => {
    const seen = new Map<string, number>();
    return new Map(
      sets.map((set) => {
        const count = (seen.get(set.write) ?? 0) + 1;
        seen.set(set.write, count);
        return [`${set.write}#${String(count)}`, set];
      }),
    );
  };
  const before = key(rereadSets(base));
  const after = key(rereadSets(final));
  const found: Difference[] = [];
  for (const [name, set] of before) {
    const other = after.get(name);
    if (other === undefined) continue;
    for (const read of set.reads) {
      if (!other.reads.includes(read)) {
        found.push({ test, area: 'reread', type: 'removed', after: set.write, base: read });
      }
    }
    for (const read of other.reads) {
      if (!set.reads.includes(read)) {
        found.push({ test, area: 'reread', type: 'added', after: set.write, final: read });
      }
    }
  }
  return found;
}

export function compareTests(base: readonly TestTrace[], final: readonly TestTrace[]): Comparison {
  const finalByKey = new Map(final.map((each) => [each.key, each]));
  const baseKeys = new Set(base.map((each) => each.key));
  const differences: Difference[] = [];
  let compared = 0;
  const requests = { base: 0, final: 0 };
  for (const before of base) {
    const after = finalByKey.get(before.key);
    if (after === undefined) continue;
    compared += 1;
    requests.base += before.entries.length;
    requests.final += after.entries.length;
    differences.push(
      ...sequenceDifferences(
        before.key,
        'requests',
        before.entries.map(requestLine),
        after.entries.map(requestLine),
        true,
      ),
      ...rereadDifferences(before.key, before.entries, after.entries),
      ...sequenceDifferences(before.key, 'storage', before.storage, after.storage, false),
      ...sequenceDifferences(before.key, 'focus', before.focus, after.focus, false),
    );
  }
  return {
    compared,
    onlyBase: base.filter((each) => !finalByKey.has(each.key)).map((each) => each.key),
    onlyFinal: final.filter((each) => !baseKeys.has(each.key)).map((each) => each.key),
    requests,
    differences,
  };
}

export interface Timing {
  readonly spec: string;
  readonly tests: number;
  readonly base: number;
  readonly final: number;
  readonly ratio: number;
}

const specOf = (key: string): string => key.split(' > ')[0] ?? key;

// Wall time per spec, summed over the tests both recordings hold.
export function timingBySpec(base: readonly TestTrace[], final: readonly TestTrace[]): Timing[] {
  const after = new Map(final.map((each) => [each.key, each]));
  const sums = new Map<string, { tests: number; base: number; final: number }>();
  for (const before of base) {
    const other = after.get(before.key);
    if (other === undefined || before.durationMs === undefined || other.durationMs === undefined) {
      continue;
    }
    const sum = sums.get(specOf(before.key)) ?? { tests: 0, base: 0, final: 0 };
    sums.set(specOf(before.key), {
      tests: sum.tests + 1,
      base: sum.base + before.durationMs,
      final: sum.final + other.durationMs,
    });
  }
  return [...sums.entries()]
    .map(([spec, sum]) => ({ spec, ...sum, ratio: sum.base === 0 ? 0 : sum.final / sum.base }))
    .sort((a, b) => (a.spec < b.spec ? -1 : 1));
}

export interface Load {
  readonly requests: number;
  readonly bytes: number;
  readonly ttfb: number;
  readonly total: number;
}

// What a test asked of the server and what it cost, for telling a slowdown in
// the server from one in the browser: `ttfb` is the sum of the time requests
// waited for a first byte.
export function loadOf(trace: TestTrace): Load {
  return trace.entries.reduce<Load>(
    (sum, each) => ({
      requests: sum.requests + 1,
      bytes: sum.bytes + (each.bytes ?? 0),
      ttfb: sum.ttfb + (each.ttfb ?? 0),
      total: sum.total + (each.total ?? 0),
    }),
    { requests: 0, bytes: 0, ttfb: 0, total: 0 },
  );
}

const rule = z.object({
  id: z.string(),
  kind: z.enum(['registered', 'benign']),
  why: z.string(),
  area: z.enum(['requests', 'reread', 'storage', 'focus']).optional(),
  type: z.enum(['added', 'removed', 'changed', 'moved']).optional(),
  test: z.string().optional(),
  line: z.string().optional(),
  after: z.string().optional(),
});

export type Rule = z.infer<typeof rule>;

export function readRules(file: URL | string): Rule[] {
  return z.array(rule).parse(JSON.parse(readFileSync(file, 'utf8')));
}

const withoutStatus = (text: string): string => text.replace(/ -> (\d+|aborted)/u, ' -> *');

// A request cut short by the page leaving is the same request, issued; whether
// it finished first is a matter of timing.
function cutShort(difference: Difference): boolean {
  const { base, final } = difference;
  if (difference.type !== 'changed' || base === undefined || final === undefined) return false;
  return (
    (base.includes(' -> aborted') || final.includes(' -> aborted')) &&
    withoutStatus(base) === withoutStatus(final)
  );
}

function matches(each: Rule, difference: Difference): boolean {
  const text = difference.final ?? difference.base ?? '';
  return (
    (each.area === undefined || each.area === difference.area) &&
    (each.type === undefined || each.type === difference.type) &&
    (each.test === undefined || new RegExp(each.test, 'u').test(difference.test)) &&
    (each.line === undefined || new RegExp(each.line, 'u').test(text)) &&
    (each.after === undefined || new RegExp(each.after, 'u').test(difference.after ?? ''))
  );
}

export function explanationOf(difference: Difference, rules: readonly Rule[]): string | null {
  if (cutShort(difference)) return 'timing: a request cut short by navigation';
  return rules.find((each) => matches(each, difference))?.id ?? null;
}

const entry = z.object({
  ctx: z.number(),
  kind: z.enum(['api', 'nav']),
  method: z.string(),
  path: z.string(),
  query: z.string(),
  conditional: z.array(z.string()),
  contentType: z.string().nullable(),
  body: z.string().nullable(),
  status: z.union([z.number(), z.literal('aborted')]),
  cache: z.string().nullable(),
  etag: z.string().nullable(),
  ttfb: z.number().optional(),
  total: z.number().optional(),
  bytes: z.number().optional(),
});

const line = z.object({
  key: z.string(),
  outcome: z.string(),
  durationMs: z.number().optional(),
  entries: z.array(entry),
  storage: z.array(z.string()),
  focus: z.array(z.string()),
});

export function readTrace(file: string): TestTrace[] {
  const seen = new Map<string, number>();
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((text) => text !== '')
    .map((text) => {
      const parsed = line.parse(JSON.parse(text));
      const count = (seen.get(parsed.key) ?? 0) + 1;
      seen.set(parsed.key, count);
      return { ...parsed, key: count === 1 ? parsed.key : `${parsed.key} #${String(count)}` };
    });
}

function show(each: Difference): string {
  const where = each.after === undefined ? '' : ` after ${each.after}:`;
  const sign = { added: '+', removed: '-', changed: '~', moved: '>' }[each.type];
  const text =
    each.type === 'changed'
      ? `${each.base ?? ''}\n        => ${each.final ?? ''}`
      : (each.final ?? each.base ?? '');
  return `  [${each.area}] ${sign}${where} ${text}`;
}

function timingReport(base: readonly TestTrace[], final: readonly TestTrace[]): string {
  const rows = timingBySpec(base, final).map(
    (each) =>
      `${each.spec.padEnd(34)} ${String(each.tests).padStart(3)} ${(each.base / 1000).toFixed(1).padStart(8)}s ${(each.final / 1000).toFixed(1).padStart(8)}s  x${each.ratio.toFixed(2)}`,
  );
  const sum = (list: readonly TestTrace[]): Load =>
    list.map(loadOf).reduce((a, b) => ({
      requests: a.requests + b.requests,
      bytes: a.bytes + b.bytes,
      ttfb: a.ttfb + b.ttfb,
      total: a.total + b.total,
    }));
  const show = (name: string, load: Load): string =>
    `${name}: ${String(load.requests)} requests, ${String(load.bytes)} bytes, first byte waited ${(load.ttfb / 1000).toFixed(1)}s, transfers ${(load.total / 1000).toFixed(1)}s`;
  return [...rows, show('base ', sum(base)), show('final', sum(final))].join('\n');
}

function main(): number {
  const args = process.argv.slice(2);
  const [baseFile, finalFile] = args.filter((each) => !each.startsWith('--'));
  if (baseFile === undefined || finalFile === undefined) {
    process.stderr.write('usage: node e2e/trace-diff.ts <base.jsonl> <final.jsonl>\n');
    return 2;
  }
  if (args.includes('--timing')) {
    process.stdout.write(`${timingReport(readTrace(baseFile), readTrace(finalFile))}\n`);
    return 0;
  }
  const rules = readRules(new URL('./trace-registered.json', import.meta.url));
  const base = readTrace(baseFile);
  const final = readTrace(finalFile);
  const result = compareTests(base, final);
  const outcomes = [...base, ...final].filter(
    (each) => each.outcome !== 'passed' && each.outcome !== 'skipped',
  );
  const explained = new Map<string, Difference[]>();
  const unexplained: Difference[] = [];
  for (const each of result.differences) {
    const why = explanationOf(each, rules);
    if (why === null) unexplained.push(each);
    else explained.set(why, [...(explained.get(why) ?? []), each]);
  }
  const out: string[] = [];
  out.push(
    `tests: base ${String(base.length)}, final ${String(final.length)}, compared ${String(result.compared)}`,
    `requests: base ${String(result.requests.base)}, final ${String(result.requests.final)}`,
    `only in base: ${result.onlyBase.length === 0 ? 'none' : result.onlyBase.join('; ')}`,
    `only in final: ${result.onlyFinal.length === 0 ? 'none' : result.onlyFinal.join('; ')}`,
    `tests that did not pass: ${outcomes.length === 0 ? 'none' : outcomes.map((each) => `${each.key} (${each.outcome})`).join('; ')}`,
    `differences: ${String(result.differences.length)}, explained ${String(result.differences.length - unexplained.length)}, unexplained ${String(unexplained.length)}`,
  );
  for (const [why, list] of explained) out.push(`  explained by ${why}: ${String(list.length)}`);
  const tests = [...new Set(unexplained.map((each) => each.test))];
  for (const test of tests) {
    out.push('', test, ...unexplained.filter((each) => each.test === test).map(show));
  }
  process.stdout.write(`${out.join('\n')}\n`);
  return unexplained.length === 0 ? 0 : 1;
}

if (import.meta.main) process.exitCode = main();
