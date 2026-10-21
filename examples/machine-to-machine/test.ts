// Runs the client against a stack provisioned by ../_shared/provision.sh, with
// the API example running beside it, and checks what the client printed.
import assert from 'node:assert/strict';
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { after, before, test } from 'node:test';

const API_PORT = '8082';
let api: ChildProcess;

before(async () => {
  api = spawn(process.execPath, ['server.ts'], {
    cwd: new URL('../api/', import.meta.url),
    env: { ...process.env, PORT: API_PORT },
    stdio: 'inherit',
  });
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      await fetch(`http://localhost:${API_PORT}/`);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  throw new Error('the API never answered');
});

after(() => {
  api.kill();
});

test('gets a token as itself and calls the API with it', () => {
  const output = execFileSync(process.execPath, ['client.ts'], {
    env: { ...process.env, API_URL: `http://localhost:${API_PORT}` },
    encoding: 'utf8',
  });
  assert.match(output, /API answered 200/u);
  assert.match(output, /example-m2m/u);
});

test('is refused with the wrong secret', () => {
  assert.throws(
    () =>
      execFileSync(process.execPath, ['client.ts'], {
        env: { ...process.env, CLIENT_SECRET: 'not-the-secret' },
        stdio: 'pipe',
      }),
    /invalid_client/u,
  );
});
