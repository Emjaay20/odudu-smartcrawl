import { globSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// The capture signs in as a generated administrator whose password lives in a
// shell variable and a child's environment. Nothing may print it: not a trace
// (`set -x`, `bash -x`) and not a line that writes the variable out.
const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const SCRIPTS = [
  'apps/docs/scripts/console-shots/with-stack.sh',
  ...globSync('apps/docs/scripts/console-shots/*.ts', { cwd: REPO_ROOT }).filter(
    (file) => !file.endsWith('.test.ts'),
  ),
];
// A workflow may write a masked secret to its environment file; it may not trace.
const WORKFLOWS = globSync('.github/workflows/*.yml', { cwd: REPO_ROOT });

const TRACE = /(?:^|[\s;&|])(?:set\s+-[a-z]*x|set\s+-o\s+xtrace|(?:ba|z)?sh\s+-[a-z]*x)/mu;
const PRINTS =
  /\b(?:echo|printf|console\.(?:log|error|warn|info)|process\.std(?:out|err)\.write)\b/u;
const PASSWORD = /password|ADMIN_PASSWORD/iu;

function traces(source: string): string[] {
  return TRACE.test(source) ? ['turns on a shell trace'] : [];
}

function leaks(source: string): string[] {
  const found: string[] = traces(source);
  for (const [index, line] of source.split('\n').entries()) {
    if (
      PRINTS.test(line) &&
      PASSWORD.test(line) &&
      /\$\{?\w*password|\bpassword\b\s*[,)}]|\$\{[^}]*password/iu.test(line)
    ) {
      found.push(`line ${String(index + 1)} writes the password`);
    }
  }
  return found;
}

describe('the capture and the workflows', () => {
  it('names the scripts it holds to this', () => {
    expect(SCRIPTS).toContain('apps/docs/scripts/console-shots/with-stack.sh');
    expect(SCRIPTS.some((file) => file.endsWith('capture.ts'))).toBe(true);
    expect(WORKFLOWS.some((file) => file.endsWith('verify.yml'))).toBe(true);
  });

  it.each(SCRIPTS)('does not trace or print the administrator password: %s', (file) => {
    expect(leaks(readFileSync(path.join(REPO_ROOT, file), 'utf8')), file).toEqual([]);
  });

  it.each(WORKFLOWS)('does not turn on a shell trace: %s', (file) => {
    expect(traces(readFileSync(path.join(REPO_ROOT, file), 'utf8')), file).toEqual([]);
  });

  it('notices a trace and a line that prints the password', () => {
    expect(leaks('set -euo pipefail\nset -x\n')).toEqual(['turns on a shell trace']);
    expect(leaks('set -euxo pipefail\n')).toEqual(['turns on a shell trace']);
    expect(leaks('bash -x with-stack.sh\n')).toEqual(['turns on a shell trace']);
    expect(leaks('set -euo pipefail\n')).toEqual([]);
    expect(leaks('echo "password is $password"\n')).toEqual(['line 1 writes the password']);
    expect(leaks('console.log(`pw ${options.adminPassword}`);\n')).toEqual([
      'line 1 writes the password',
    ]);
    expect(leaks('password="$(compose exec odudu seed admin | head -n 1)"\n')).toEqual([]);
  });
});
