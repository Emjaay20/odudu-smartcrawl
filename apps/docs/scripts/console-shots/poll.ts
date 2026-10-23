export interface Settling {
  readonly timeoutMs: number;
  readonly intervalMs: number;
  // How many reads in a row must be accepted and equal before the answer is
  // taken as settled, so a list passing through the right rows is not one.
  readonly settledReads?: number;
  readonly wait?: (ms: number) => Promise<unknown>;
}

const sleep = (ms: number): Promise<unknown> => new Promise((done) => setTimeout(done, ms));

/**
 * Reads until a read is accepted and the same read is taken again, or the time
 * is up. A failure carries the last read, so the next one says what was seen.
 */
export async function untilSettled<T>(
  read: () => Promise<T>,
  accept: (value: T) => boolean,
  { timeoutMs, intervalMs, settledReads = 2, wait = sleep }: Settling,
): Promise<T> {
  const started = Date.now();
  let last: T | undefined;
  let streak = 0;
  let again: string | undefined;
  for (;;) {
    last = await read();
    const text = JSON.stringify(last);
    streak = accept(last) && text === again ? streak + 1 : accept(last) ? 1 : 0;
    again = accept(last) ? text : undefined;
    if (streak >= settledReads) return last;
    if (Date.now() - started >= timeoutMs) {
      throw new Error(
        `not settled after ${String(timeoutMs)} ms; last read ${JSON.stringify(last)}`,
      );
    }
    await wait(intervalMs);
  }
}
