import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import type { Browser, BrowserContext, Request, Response, TestInfo } from '@playwright/test';
import { z } from 'zod';
import type { TestTrace, TraceEntry } from './trace-diff';
import {
  bodyShape,
  conditionalKinds,
  focusDescriptor,
  normaliseText,
  pathTemplate,
  queryShape,
  valueClass,
} from './trace-normalise';

// Where a run records what each test's browser sent. Unset, nothing in this
// file runs: the fixture that uses it is not automatic and nobody asks for it.
export const TRACE_FILE = process.env.E2E_TRACE;
export const tracing = TRACE_FILE !== undefined && TRACE_FILE !== '';

const BINDING = '__odudu_trace';

// Runs in every page: reports each write to browser storage and each focus
// move, through the binding the recorder exposes.
const PAGE_SCRIPT = `(() => {
  const send = (kind, text) => { try { window.${BINDING}(kind, text); } catch {} };
  const proto = Storage.prototype;
  const nameOf = (storage) => { try { return storage === window.localStorage ? 'local' : 'session'; } catch { return 'session'; } };
  const write = (name, op) => {
    const original = proto[name];
    proto[name] = function (...args) {
      send('storage', JSON.stringify({ store: nameOf(this), op, key: args[0] ?? '', value: args[1] === undefined ? null : String(args[1]) }));
      return original.apply(this, args);
    };
  };
  write('setItem', 'set');
  write('removeItem', 'remove');
  write('clear', 'clear');
  document.addEventListener('focusin', (event) => {
    const node = event.target;
    if (!(node instanceof Element)) return;
    const named = ['a', 'button', 'summary', 'label', 'option', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
    const textual = named.includes(node.tagName.toLowerCase()) || ['tab', 'option', 'button', 'link', 'menuitem', 'switch', 'checkbox', 'radio'].includes(node.getAttribute('role') ?? '');
    const label = node.getAttribute('aria-label') ?? node.labels?.[0]?.textContent ?? node.getAttribute('placeholder') ?? (textual ? node.textContent : '') ?? '';
    send('focus', JSON.stringify({
      tag: node.tagName.toLowerCase(),
      role: node.getAttribute('role'),
      name: label.slice(0, 80),
      dialog: node.closest('[role="dialog"],[role="alertdialog"]') !== null,
    }));
  }, true);
})();`;

interface Recording {
  readonly entries: TraceEntry[];
  readonly storage: string[];
  readonly focus: string[];
}

function mime(value: string | undefined): string | null {
  const type = value?.split(';')[0]?.trim().toLowerCase();
  return type === undefined || type === '' ? null : type;
}

function etagKind(value: string | undefined): string | null {
  if (value === undefined) return null;
  return value.startsWith('W/') ? 'weak' : 'strong';
}

function entryOf(request: Request, context: number): TraceEntry | null {
  const type = request.resourceType();
  const kind = type === 'fetch' || type === 'xhr' ? 'api' : type === 'document' ? 'nav' : null;
  if (kind === null) return null;
  const url = new URL(request.url());
  const headers = request.headers();
  const body = bodyShape(headers['content-type'] ?? null, request.postData());
  return {
    ctx: context,
    kind,
    method: request.method(),
    path: pathTemplate(url.pathname),
    query: queryShape(url.search),
    conditional: conditionalKinds(headers),
    // A redirect keeps the content type of the POST it answered, not its body.
    contentType: body === null ? null : mime(headers['content-type']),
    body,
    status: 'aborted',
    cache: null,
    etag: null,
  };
}

function withResponse(entry: TraceEntry, response: Response): TraceEntry {
  const headers = response.headers();
  return {
    ...entry,
    status: response.status(),
    cache: headers['cache-control'] ?? null,
    etag: etagKind(headers.etag),
  };
}

const storageWrite = z.object({
  store: z.string(),
  op: z.string(),
  key: z.string(),
  value: z.string().nullable(),
});

const focusMove = z.object({
  tag: z.string(),
  role: z.string().nullable(),
  name: z.string(),
  dialog: z.boolean(),
});

function storageLine(text: string): string {
  const { store, op, key, value } = storageWrite.parse(JSON.parse(text));
  const name = normaliseText(key);
  if (op === 'set') return `${store} set ${name} ${valueClass(value ?? '')}`;
  return `${store} ${op} ${op === 'clear' ? '' : name}`.trim();
}

function focusLine(text: string): string {
  return focusDescriptor(focusMove.parse(JSON.parse(text)));
}

async function attach(context: BrowserContext, index: number, recording: Recording): Promise<void> {
  const open = new Map<Request, number>();
  context.on('request', (request) => {
    const entry = entryOf(request, index);
    if (entry === null) return;
    open.set(request, recording.entries.length);
    recording.entries.push(entry);
  });
  context.on('response', (response) => {
    const at = open.get(response.request());
    const entry = at === undefined ? undefined : recording.entries[at];
    if (at !== undefined && entry !== undefined)
      recording.entries[at] = withResponse(entry, response);
  });
  await context.exposeBinding(BINDING, (_source, kind: string, text: string) => {
    if (kind === 'storage') recording.storage.push(storageLine(text));
    else if (kind === 'focus') {
      const line = focusLine(text);
      if (recording.focus.at(-1) !== line) recording.focus.push(line);
    }
  });
  await context.addInitScript(PAGE_SCRIPT);
}

function keyOf(info: TestInfo): string {
  const [file, ...rest] = info.titlePath;
  return [path.basename(file ?? info.file), ...rest].join(' > ');
}

// Records every context the test opens, its own page's and the ones it makes
// with `browser.newContext` or `browser.newPage`, and appends one line to the
// trace file when the test is over.
export async function traceFixture(
  { browser }: { browser: Browser },
  run: (value: undefined) => Promise<void>,
  info: TestInfo,
): Promise<void> {
  const recording: Recording = { entries: [], storage: [], focus: [] };
  const original = browser.newContext.bind(browser);
  let opened = 0;
  browser.newContext = async (options) => {
    const context = await original(options);
    opened += 1;
    await attach(context, opened - 1, recording);
    return context;
  };
  try {
    await run(undefined);
  } finally {
    browser.newContext = original;
    const line: TestTrace = {
      key: keyOf(info),
      outcome: info.status ?? 'unknown',
      entries: recording.entries,
      storage: recording.storage,
      focus: recording.focus,
    };
    if (TRACE_FILE !== undefined) {
      mkdirSync(path.dirname(TRACE_FILE), { recursive: true });
      appendFileSync(TRACE_FILE, `${JSON.stringify(line)}\n`);
    }
  }
}
