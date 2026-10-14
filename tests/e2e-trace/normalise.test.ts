import { describe, expect, it } from 'vitest';
import {
  bodyShape,
  conditionalKinds,
  focusDescriptor,
  normaliseText,
  pathTemplate,
  queryShape,
  valueClass,
} from '../../apps/admin-console/e2e/trace-normalise.js';

const UUID = '3f2b8c1e-7a4d-4e0b-9c55-0d1e2f3a4b5c';

describe('normaliseText', () => {
  it('replaces the per-run tenant prefix, keeping the suffix a seed gives it', () => {
    expect(normaliseText('e2e-mv76su6b-a')).toBe('e2e-RUN-a');
    expect(normaliseText('made-e2e-mv76su6b')).toBe('made-e2e-RUN');
  });

  it('replaces uuids, timestamps and long numbers', () => {
    expect(normaliseText(`id ${UUID}`)).toBe('id :uuid');
    expect(normaliseText('at 2026-10-14T16:41:03.512Z')).toBe('at :ts');
    expect(normaliseText('n 1760460063512')).toBe('n :num');
  });

  it('does not name the port a stack was started on', () => {
    expect(normaliseText('http://localhost:3092/cb')).toBe('http://localhost:PORT/cb');
  });

  it('replaces a generated secret but keeps a long name made of letters alone', () => {
    expect(normaliseText('6H3uNOz4nKyG3YW5z-yqOssc')).toBe(':token');
    const unbroken = 'segment'.repeat(8);
    expect(normaliseText(unbroken)).toBe(unbroken);
  });
});

describe('pathTemplate', () => {
  it('templates each segment on its own', () => {
    expect(pathTemplate(`/console/api/admin/tenants/e2e-mv76su6b-k/clients/${UUID}/roles`)).toBe(
      '/console/api/admin/tenants/e2e-RUN-k/clients/:uuid/roles',
    );
  });

  it('decodes a segment before it is read', () => {
    expect(pathTemplate('/a/%2Fadmins')).toBe('/a//admins');
  });
});

describe('queryShape', () => {
  it('sorts keys, keeps plain values and names a cursor by its kind', () => {
    expect(queryShape('?limit=50&after=eyJhIjoxfQ.abc&q=ada')).toBe('after=:cursor&limit=50&q=ada');
  });

  it('keeps an empty value empty', () => {
    expect(queryShape('?q=')).toBe('q=');
  });

  it('is empty without a query', () => {
    expect(queryShape('')).toBe('');
  });
});

describe('conditionalKinds', () => {
  it('names the kind of a validator and never its value', () => {
    expect(
      conditionalKinds({ 'if-match': 'W/"abc"', 'if-none-match': '*', 'x-odudu-console': '1' }),
    ).toEqual(['if-match:weak', 'if-none-match:star', 'x-odudu-console:1']);
  });

  it('reads a strong validator and an unknown subject header', () => {
    expect(conditionalKinds({ 'if-match': '"abc"', 'x-odudu-subject': UUID })).toEqual([
      'if-match:strong',
      'x-odudu-subject::uuid',
    ]);
  });

  it('ignores headers a browser adds on its own', () => {
    expect(
      conditionalKinds({ accept: '*/*', 'user-agent': 'x', 'sec-fetch-mode': 'cors' }),
    ).toEqual([]);
  });
});

describe('bodyShape', () => {
  it('records a JSON body by its keys, with scalars normalised', () => {
    expect(bodyShape('application/json', JSON.stringify({ name: 'ledger', id: UUID, n: 3 }))).toBe(
      '{id:":uuid",n:3,name:"ledger"}',
    );
  });

  it('records a secret by its length class alone', () => {
    const body = JSON.stringify({ password: 'correct-horse-battery', client_secret: 'x' });
    expect(bodyShape('application/json', body)).toBe(
      '{client_secret:<secret len1-8>,password:<secret len9-32>}',
    );
  });

  it('records nested values and arrays', () => {
    const body = JSON.stringify({ uris: ['https://a.example/cb'], on: true, none: null });
    expect(bodyShape('application/json', body)).toBe(
      '{none:null,on:true,uris:["https://a.example/cb"]}',
    );
  });

  it('records a form body by its fields', () => {
    expect(
      bodyShape('application/x-www-form-urlencoded', `username=ada&password=hunter2hunter2`),
    ).toBe('password=<secret len9-32>&username=ada');
  });

  it('records anything else by its size class', () => {
    expect(bodyShape('text/plain', 'x'.repeat(40))).toBe('<bytes len33+>');
  });

  it('is null without a body', () => {
    expect(bodyShape(null, null)).toBeNull();
  });
});

describe('valueClass', () => {
  it('keeps a short lowercase word, a number and a flag, and classes the rest by length', () => {
    expect(valueClass('collapsed')).toBe('word:collapsed');
    expect(valueClass('true')).toBe('word:true');
    expect(valueClass('')).toBe('len0');
    expect(valueClass('Ada Lovelace')).toBe('len9-32');
    expect(valueClass('e2e-mv76su6b-k')).toBe('word:e2e-RUN-k');
    expect(valueClass('x'.repeat(40))).toBe('len33+');
  });

  it('records a JSON value by its keys and the class of each scalar', () => {
    expect(valueClass(JSON.stringify({ a: 'hello there friend', b: 2 }))).toBe(
      'json{a:len9-32,b:2}',
    );
  });
});

describe('focusDescriptor', () => {
  it('names the target by role, name and whether it is in a dialog', () => {
    expect(
      focusDescriptor({ tag: 'button', role: null, name: ' Delete  client ', dialog: true }),
    ).toBe('dialog button "Delete client"');
    expect(focusDescriptor({ tag: 'input', role: 'textbox', name: '', dialog: false })).toBe(
      'page input[textbox] ""',
    );
  });
});
