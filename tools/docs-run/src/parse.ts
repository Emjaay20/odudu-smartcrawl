export interface RunnableBlock {
  readonly file: string;
  readonly line: number;
  readonly command: string;
  readonly expect: readonly string[];
  readonly env: Readonly<Record<string, string>>;
}

export const TIMEOUT_ENV = 'ODUDU_DOCS_RUN_TIMEOUT_S';

const OPENING = /^(`{3,})(.*)$/u;
const RUNNABLE_INFO = /^sh\s+\{run((?:\s+[^}]*)?)\}\s*$/u;
const ATTRIBUTE = /expect="([^"]*)"|timeout=(\d+)/gu;

function attributes(raw: string): Pick<RunnableBlock, 'expect' | 'env'> {
  const expect: string[] = [];
  const env: Record<string, string> = {};
  for (const match of raw.matchAll(ATTRIBUTE)) {
    if (match[1] !== undefined) expect.push(match[1]);
    if (match[2] !== undefined) env[TIMEOUT_ENV] = match[2];
  }
  return { expect, env };
}

/**
 * Fences tagged `sh {run}`, in document order. A fence closes on a run of
 * backticks at least as long as the one that opened it, so a three-tick
 * example inside a four-tick fence is content, not a block.
 */
export function extractRunnable(markdown: string, file: string): RunnableBlock[] {
  const lines = markdown.split('\n');
  const found: RunnableBlock[] = [];
  let index = 0;
  while (index < lines.length) {
    const opening = OPENING.exec(lines[index] ?? '');
    if (opening === null) {
      index += 1;
      continue;
    }
    const ticks = opening[1]?.length ?? 3;
    const start = index;
    const body: string[] = [];
    index += 1;
    while (index < lines.length) {
      const close = /^(`{3,})\s*$/u.exec(lines[index] ?? '');
      if (close !== null && (close[1]?.length ?? 0) >= ticks) break;
      body.push(lines[index] ?? '');
      index += 1;
    }
    index += 1;
    const info = RUNNABLE_INFO.exec((opening[2] ?? '').trim());
    if (info === null) continue;
    found.push({ file, line: start + 1, command: body.join('\n'), ...attributes(info[1] ?? '') });
  }
  return found;
}

const CHARACTERS: readonly { readonly pattern: RegExp; readonly what: string }[] = [
  { pattern: /[‘’“”]/u, what: 'a smart quote' },
  { pattern: /[‐-―−]/u, what: 'a non-ASCII hyphen or dash' },
  { pattern: /[​﻿]/u, what: 'a zero-width character' },
];

function codePoint(character: string): string {
  const value = character.codePointAt(0) ?? 0;
  return `U+${value.toString(16).toUpperCase().padStart(4, '0')}`;
}

/** What would make a copied command differ from the one that was run. */
export function lintCommand(block: RunnableBlock): string[] {
  const where = `${block.file}:${String(block.line)}`;
  const findings: string[] = [];
  for (const { pattern, what } of CHARACTERS) {
    const hit = pattern.exec(block.command);
    if (hit !== null) findings.push(`${where}: ${what} (${codePoint(hit[0])}) in the command`);
  }
  if (/^(\$|>) /u.test(block.command)) {
    findings.push(`${where}: the command starts with a prompt`);
  }
  const lines = block.command.split('\n');
  if (lines.filter((line) => line.trim() !== '').length > 1) {
    findings.push(`${where}: more than one command line`);
  }
  if (/\\$/u.test(block.command)) findings.push(`${where}: a trailing backslash continuation`);
  if (block.command.includes('\t')) findings.push(`${where}: a tab in the command`);
  if (/ $/mu.test(block.command)) findings.push(`${where}: a trailing space`);
  return findings;
}
