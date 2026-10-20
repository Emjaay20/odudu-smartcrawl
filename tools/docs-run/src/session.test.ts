import { describe, expect, it } from 'vitest';
import { openSession } from '#/session';

async function inSession<T>(use: (s: ReturnType<typeof openSession>) => Promise<T>): Promise<T> {
  const session = openSession();
  try {
    return await use(session);
  } finally {
    await session.close();
  }
}

describe('openSession', () => {
  it('keeps the working directory between blocks', async () => {
    const out = await inSession(async (s) => {
      await s.exec('cd /', {}, {});
      return s.exec('pwd', {}, {});
    });
    expect(out).toEqual({ status: 0, output: '/' });
  });

  it('keeps exported variables between blocks', async () => {
    const out = await inSession(async (s) => {
      await s.exec('export DOCS_RUN_X=kept', {}, {});
      return s.exec('echo "$DOCS_RUN_X"', {}, {});
    });
    expect(out.output).toBe('kept');
  });

  it('returns the output without the status marker, stderr included', async () => {
    const out = await inSession((s) => s.exec('echo out; echo err >&2', {}, {}));
    expect(out).toEqual({ status: 0, output: 'out\nerr' });
  });

  it('reports a failing command as its status', async () => {
    const out = await inSession((s) => s.exec('sh -c "exit 3"', {}, {}));
    expect(out.status).toBe(3);
  });

  it('ends the shell at the first failure under set -e, so later blocks fail too', async () => {
    const [first, second] = await inSession(async (s) => [
      await s.exec('false', {}, {}),
      await s.exec('echo after', {}, {}),
    ]);
    expect(first.status).not.toBe(0);
    expect(second.status).not.toBe(0);
    expect(second.output).not.toContain('after');
  });

  it('kills a command that outlives its timeout and returns 124', async () => {
    const started = Date.now();
    const out = await inSession((s) => s.exec('sleep 30', {}, { timeoutSeconds: 1 }));
    expect(out.status).toBe(124);
    expect(out.output).toContain('timed out after 1s');
    expect(Date.now() - started).toBeLessThan(10_000);
  });

  it('exports the env it is handed, quoted', async () => {
    const out = await inSession((s) => s.exec('echo "$A"', { A: "it's" }, {}));
    expect(out.output).toBe("it's");
  });
});
