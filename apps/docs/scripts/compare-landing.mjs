// Compares the landing page of two built sites pixel by pixel.
//   node scripts/compare-landing.mjs <dist/pages A> <dist/pages B> [--base /odudu/]
// Each build is served by serve.mjs, captured in Chromium under reduced motion
// (so nothing animates) at 1280 and 375 px wide in both colour schemes, and the
// PNGs are decoded and compared on a canvas in the same Chromium, so no image
// library is needed. Prints the differing pixel count and the largest channel
// difference per capture; exits 1 if any capture differs.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { base: { type: 'string', default: '/odudu/' } },
});
const [dirA, dirB] = positionals;
if (dirA === undefined || dirB === undefined) {
  console.error('usage: compare-landing.mjs <dist/pages A> <dist/pages B> [--base /odudu/]');
  process.exit(2);
}
const base = values.base;
const VIEWS = [
  ['desktop', 1280, 800],
  ['mobile', 375, 812],
];
const STEPS = [
  [3, 'Sign in once'],
  [4, 'Back with a signed'],
  [6, 'Already signed in'],
  [7, 'Signed out where'],
];
const serve = path.join(import.meta.dirname, 'serve.mjs');

function start(dir, port) {
  const child = spawn(
    process.execPath,
    [serve, path.resolve(dir), '--base', base, '--port', String(port)],
    { stdio: ['ignore', 'pipe', 'inherit'] },
  );
  return new Promise((resolve) => {
    child.stdout.once('data', () => {
      resolve(child);
    });
  });
}

async function capture(browser, port, out) {
  for (const scheme of ['light', 'dark']) {
    for (const [name, width, height] of VIEWS) {
      const context = await browser.newContext({
        colorScheme: scheme,
        viewport: { width, height },
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      await page.goto(`http://127.0.0.1:${port}${base}`);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(800);
      const stem = `${name}-${scheme}`;
      await page.screenshot({ path: path.join(out, `${stem}-fold.png`) });
      await page.screenshot({ path: path.join(out, `${stem}-full.png`), fullPage: true });
      for (const [step, label] of STEPS) {
        await page.getByRole('button', { name: new RegExp(label, 'u') }).click();
        await page.waitForTimeout(500);
        await page
          .locator('[data-section="signin"]')
          .screenshot({ path: path.join(out, `${stem}-step${step}.png`) });
      }
      await context.close();
    }
  }
}

const COMPARE = async ([first, second]) => {
  const load = (b64) =>
    new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        resolve(image);
      };
      image.src = `data:image/png;base64,${b64}`;
    });
  const [a, b] = await Promise.all([load(first), load(second)]);
  if (a.width !== b.width || a.height !== b.height) {
    return { sizes: `${a.width}x${a.height} vs ${b.width}x${b.height}` };
  }
  const pixels = (image) => {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    return context.getImageData(0, 0, image.width, image.height).data;
  };
  const left = pixels(a);
  const right = pixels(b);
  let differing = 0;
  let largest = 0;
  for (let at = 0; at < left.length; at += 4) {
    const gap = Math.max(
      Math.abs(left[at] - right[at]),
      Math.abs(left[at + 1] - right[at + 1]),
      Math.abs(left[at + 2] - right[at + 2]),
    );
    if (gap > 0) differing += 1;
    if (gap > largest) largest = gap;
  }
  return { pixels: left.length / 4, differing, largest };
};

const work = await mkdtemp(path.join(tmpdir(), 'compare-landing-'));
const servers = [];
const browser = await chromium.launch();
let failed = false;
try {
  const outs = [path.join(work, 'a'), path.join(work, 'b')];
  const ports = [4181, 4182];
  const dirs = [dirA, dirB];
  for (const [index, dir] of dirs.entries()) {
    servers.push(await start(dir, ports[index]));
    await mkdir(outs[index], { recursive: true });
    await capture(browser, ports[index], outs[index]);
  }
  const names = (await readdir(outs[0])).filter((name) => name.endsWith('.png')).sort();
  const page = await browser.newPage();
  await page.goto('about:blank');
  for (const name of names) {
    const [first, second] = await Promise.all(
      outs.map(async (dir) => (await readFile(path.join(dir, name))).toString('base64')),
    );
    const result = await page.evaluate(COMPARE, [first, second]);
    const same = result.differing === 0;
    if (!same) failed = true;
    console.log(`${same ? 'same  ' : 'DIFFER'} ${name} ${JSON.stringify(result)}`);
  }
} finally {
  await browser.close();
  for (const server of servers) server.kill();
  await rm(work, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
