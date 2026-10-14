import { describe, expect, it } from 'vitest';
import {
  compareTests,
  explanationOf,
  loadOf,
  readRules,
  rereadSets,
  timingBySpec,
  requestLine,
  type TestTrace,
  type TraceEntry,
} from '../../apps/admin-console/e2e/trace-diff.js';

function entry(method: string, path: string, extra: Partial<TraceEntry> = {}): TraceEntry {
  return {
    ctx: 0,
    kind: 'api',
    method,
    path,
    query: '',
    conditional: [],
    contentType: null,
    body: null,
    status: method === 'GET' ? 200 : 204,
    cache: null,
    etag: null,
    ...extra,
  };
}

function trace(key: string, entries: TraceEntry[], more: Partial<TestTrace> = {}): TestTrace {
  return { key, outcome: 'passed', entries, storage: [], focus: [], ...more };
}

const LIST = entry('GET', '/console/api/admin/clients');
const ROLES = entry('GET', '/console/api/admin/roles');
const DELETE = entry('DELETE', '/console/api/admin/clients/:uuid');

describe('requestLine', () => {
  it('shows what was sent and what answered', () => {
    expect(
      requestLine(
        entry('PUT', '/x', {
          conditional: ['if-match:strong'],
          contentType: 'application/json',
          body: '{a:1}',
          status: 200,
        }),
      ),
    ).toBe('PUT /x [if-match:strong] application/json {a:1} -> 200');
  });
});

describe('compareTests', () => {
  it('finds nothing between equal traces', () => {
    const result = compareTests(
      [trace('a', [LIST, DELETE, LIST])],
      [trace('a', [LIST, DELETE, LIST])],
    );
    expect(result.differences).toEqual([]);
    expect(result.compared).toBe(1);
    expect(result.requests).toEqual({ base: 3, final: 3 });
  });

  it('reports an added and a removed request', () => {
    const result = compareTests([trace('a', [LIST, DELETE])], [trace('a', [LIST, DELETE, ROLES])]);
    expect(result.differences.filter((each) => each.area === 'requests')).toEqual([
      { test: 'a', area: 'requests', type: 'added', final: 'GET /console/api/admin/roles -> 200' },
    ]);
    const back = compareTests([trace('a', [LIST, DELETE, ROLES])], [trace('a', [LIST, DELETE])]);
    expect(back.differences.map((each) => [each.area, each.type])).toEqual([
      ['requests', 'removed'],
      ['reread', 'removed'],
    ]);
  });

  it('reports a request that moved, once, not as an addition and a removal', () => {
    const result = compareTests(
      [trace('a', [LIST, ROLES, DELETE])],
      [trace('a', [ROLES, LIST, DELETE])],
    );
    expect(result.differences.map((each) => each.type)).toEqual(['moved']);
  });

  it('pairs a request that changed what it sends', () => {
    const before = entry('PUT', '/x', { body: '{a:1}' });
    const after = entry('PUT', '/x', { body: '{a:2}' });
    const result = compareTests([trace('a', [before])], [trace('a', [after])]);
    expect(result.differences).toEqual([
      {
        test: 'a',
        area: 'requests',
        type: 'changed',
        base: 'PUT /x {a:1} -> 204',
        final: 'PUT /x {a:2} -> 204',
      },
    ]);
  });

  it('names tests that exist on one side only', () => {
    const result = compareTests([trace('only-base', [LIST])], [trace('only-final', [LIST])]);
    expect(result.onlyBase).toEqual(['only-base']);
    expect(result.onlyFinal).toEqual(['only-final']);
    expect(result.compared).toBe(0);
  });

  it('compares storage writes and focus targets in their own areas', () => {
    const result = compareTests(
      [trace('a', [], { storage: ['local set rail word:open'], focus: ['page button "Open"'] })],
      [trace('a', [], { storage: ['local set rail word:shut'], focus: ['dialog button "Close"'] })],
    );
    expect(result.differences.map((each) => [each.area, each.type])).toEqual([
      ['storage', 'removed'],
      ['storage', 'added'],
      ['focus', 'removed'],
      ['focus', 'added'],
    ]);
  });

  it('reports what is read again after a write', () => {
    const result = compareTests(
      [trace('a', [LIST, DELETE, LIST])],
      [trace('a', [LIST, DELETE, LIST, ROLES])],
    );
    const reread = result.differences.filter((each) => each.area === 'reread');
    expect(reread).toEqual([
      {
        test: 'a',
        area: 'reread',
        type: 'added',
        after: 'DELETE /console/api/admin/clients/:uuid',
        final: 'GET /console/api/admin/roles',
      },
    ]);
  });
});

describe('rereadSets', () => {
  it('lists the distinct reads between each write and the next', () => {
    const sets = rereadSets([LIST, DELETE, ROLES, LIST, ROLES, DELETE, LIST]);
    expect(sets).toEqual([
      {
        write: 'DELETE /console/api/admin/clients/:uuid',
        reads: ['GET /console/api/admin/roles', 'GET /console/api/admin/clients'],
      },
      {
        write: 'DELETE /console/api/admin/clients/:uuid',
        reads: ['GET /console/api/admin/clients'],
      },
    ]);
  });

  it('is empty when nothing was written', () => {
    expect(rereadSets([LIST, ROLES])).toEqual([]);
  });
});

describe('explanationOf', () => {
  const rule = {
    id: 'roles are read again',
    kind: 'registered' as const,
    why: 'a deletion reads what it cascades to',
    area: 'reread' as const,
    type: 'added' as const,
    line: '/roles$',
    after: '^DELETE /console/api/admin/clients/',
  };

  it('matches on every field a rule names', () => {
    const difference = {
      test: 'a',
      area: 'reread' as const,
      type: 'added' as const,
      after: 'DELETE /console/api/admin/clients/:uuid',
      final: 'GET /console/api/admin/roles',
    };
    expect(explanationOf(difference, [rule])).toBe('roles are read again');
    expect(explanationOf({ ...difference, type: 'removed' }, [rule])).toBeNull();
    expect(
      explanationOf({ ...difference, final: 'GET /console/api/admin/scopes' }, [rule]),
    ).toBeNull();
    expect(explanationOf({ ...difference, test: 'b', after: 'POST /x' }, [rule])).toBeNull();
  });

  it('explains a request cut short in one run and finished in the other', () => {
    const base = 'GET /x -> aborted';
    const final = 'GET /x -> 200';
    const difference = {
      test: 'a',
      area: 'requests' as const,
      type: 'changed' as const,
      base,
      final,
    };
    expect(explanationOf(difference, [])).toContain('timing');
    expect(explanationOf({ ...difference, final: 'GET /y -> 200' }, [])).toBeNull();
    expect(explanationOf({ ...difference, base: 'GET /x -> 500' }, [])).toBeNull();
  });
});

describe('timing', () => {
  it('sums wall time per spec over the tests both recordings hold and gives the ratio', () => {
    const base = [
      trace('a.spec.ts > one', [], { durationMs: 1000 }),
      trace('a.spec.ts > two', [], { durationMs: 3000 }),
      trace('b.spec.ts > only here', [], { durationMs: 500 }),
    ];
    const final = [
      trace('a.spec.ts > one', [], { durationMs: 1500 }),
      trace('a.spec.ts > two', [], { durationMs: 4500 }),
    ];
    expect(timingBySpec(base, final)).toEqual([
      { spec: 'a.spec.ts', tests: 2, base: 4000, final: 6000, ratio: 1.5 },
    ]);
  });

  it('adds up what a test asked of the server', () => {
    const load = loadOf(
      trace('a', [
        entry('GET', '/x', { ttfb: 10, total: 30, bytes: 100 }),
        entry('GET', '/y', { ttfb: 5, total: 5, bytes: 50 }),
        entry('GET', '/z'),
      ]),
    );
    expect(load).toEqual({ requests: 3, bytes: 150, ttfb: 15, total: 35 });
  });
});

describe('the registered rules', () => {
  const rules = readRules(
    new URL('../../apps/admin-console/e2e/trace-registered.json', import.meta.url),
  );

  it('are each named once and say why', () => {
    expect(rules.length).toBeGreaterThan(0);
    expect(new Set(rules.map((each) => each.id)).size).toBe(rules.length);
    expect(rules.every((each) => each.why.length > 20)).toBe(true);
  });

  it('explain the no-store a sign-in page gained, and nothing that also changed its status', () => {
    const same = {
      test: 'a',
      area: 'requests' as const,
      type: 'changed' as const,
      base: 'GET /tenants/t/protocol/openid-connect/auth?x=1 -> 200',
      final: 'GET /tenants/t/protocol/openid-connect/auth?x=1 -> 200 cache=no-store',
    };
    expect(explanationOf(same, rules)).toContain('no-store');
    expect(
      explanationOf({ ...same, final: same.final.replace('-> 200', '-> 500') }, rules),
    ).toBeNull();
  });
});
