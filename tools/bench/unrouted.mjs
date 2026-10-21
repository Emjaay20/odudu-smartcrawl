import { Agent, request } from 'node:http';
import { loadConfig } from '../../packages/kernel/src/index.ts';
import { buildApp } from '../../apps/server/src/app.ts';
import { createLogger } from '../../apps/server/src/logger.ts';

// A burst of requests for an address nothing serves and for a route that
// fails, over real sockets with keep-alive, answered as a page and as a
// problem document. The database is one that throws on any use, so the
// numbers are the cost of the answer alone and the connection count to
// Postgres is zero by construction. Not part of the default test run:
//   node --no-warnings tools/bench/unrouted.mjs [requests] [concurrency]

const REQUESTS = Number(process.argv[2] ?? 20_000);
const CONCURRENCY = Number(process.argv[3] ?? 32);
const BROWSER = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';

function refuse() {
  throw new Error('the benchmark touched the database');
}
const forbidden = {
  db: new Proxy({}, { get: refuse }),
  sql: new Proxy(() => undefined, { get: refuse, apply: refuse }),
  close: () => Promise.resolve(),
};

const config = loadConfig({
  ODUDU_DATABASE_URL: 'postgres://u:p@localhost:5432/odudu',
  ODUDU_KEK: Buffer.alloc(32, 9).toString('base64'),
  ODUDU_LOG_LEVEL: 'silent',
});
const app = buildApp({
  database: forbidden,
  ownerDatabase: forbidden,
  kek: config.ODUDU_KEK,
  logger: createLogger(config),
  docsDir: undefined,
});
app.get('/boom', () => {
  throw new Error('boom');
});
await app.listen({ port: 0, host: '127.0.0.1' });
const address = app.server.address();
const port = typeof address === 'object' && address !== null ? address.port : 0;
const agent = new Agent({ keepAlive: true, maxSockets: CONCURRENCY });

function once(path, accept) {
  const started = process.hrtime.bigint();
  return new Promise((resolve, reject) => {
    const req = request(
      { host: '127.0.0.1', port, path, agent, headers: { accept, 'accept-language': 'en' } },
      (res) => {
        res.resume();
        res.on('end', () => resolve(Number(process.hrtime.bigint() - started) / 1e6));
      },
    );
    req.on('error', reject);
    req.end();
  });
}

async function burst(path, accept) {
  const latencies = [];
  let next = 0;
  const started = process.hrtime.bigint();
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < REQUESTS) {
        next += 1;
        latencies.push(await once(path, accept));
      }
    }),
  );
  const seconds = Number(process.hrtime.bigint() - started) / 1e9;
  latencies.sort((a, b) => a - b);
  const at = (q) => (latencies[Math.floor(latencies.length * q)] ?? 0).toFixed(2);
  return `${String(Math.round(REQUESTS / seconds)).padStart(7)} req/s   p50 ${at(0.5)} ms   p99 ${at(0.99)} ms`;
}

for (const accept of [BROWSER, 'application/json']) await burst('/warm', accept);
const rows = [
  ['404 problem document ', '/nope', 'application/json'],
  ['404 page             ', '/nope', BROWSER],
  ['404 page, tenant path', '/tenants/acme/nope', BROWSER],
  ['500 problem document ', '/boom', 'application/json'],
  ['500 page             ', '/boom', BROWSER],
];
console.log(`${String(REQUESTS)} requests, ${String(CONCURRENCY)} connections, no database`);
for (const [label, path, accept] of rows) console.log(label, await burst(path, accept));
agent.destroy();
await app.close();
