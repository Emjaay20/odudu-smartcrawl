// Starts the app, signs `ada` in through a real browser and checks what the
// app shows, then checks that a callback whose state it did not issue is
// refused. Needs a stack provisioned by ../_shared/provision.sh.
import assert from 'node:assert/strict';
import { type ChildProcess, spawn } from 'node:child_process';
import { after, before, test } from 'node:test';
import { signInThroughBrowser } from '../_shared/browser.ts';

const PORT = '8081';
const APP = `http://localhost:${PORT}`;
let app: ChildProcess;

async function waitFor(url: string): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  throw new Error(`${url} never answered`);
}

before(async () => {
  app = spawn(process.execPath, ['app.ts'], {
    env: { ...process.env, PORT },
    stdio: 'inherit',
  });
  await waitFor(`${APP}/`);
});

after(() => {
  app.kill();
});

test('signs a person in and shows who they are', async () => {
  const page = await signInThroughBrowser(APP, 'ada', 'a long and unremarkable passphrase');
  assert.match(page.url, /^http:\/\/localhost:8081\/$/u);
  assert.match(page.text, /Signed in as ada/u);
});

test('refuses a callback whose state it did not issue', async () => {
  const start = await fetch(`${APP}/login`, { redirect: 'manual' });
  const cookie = start.headers.get('set-cookie')?.split(';')[0] ?? '';
  const callback = await fetch(`${APP}/callback?code=forged&state=not-the-state`, {
    headers: { cookie },
  });
  assert.equal(callback.status, 400);
});

test('refuses a callback with no sign-in under way', async () => {
  const callback = await fetch(`${APP}/callback?code=forged&state=x`);
  assert.equal(callback.status, 400);
});
