import { createHash } from 'node:crypto';
import { type MailGate } from '@odudu/account';
import { slidingWindow } from '#/throttle';

// Unsolicited mail to one address, whoever asks: verification, reset and
// "you already have an account". At most this many an hour per tenant and
// address, so the form cannot be used to fill somebody's inbox, or to cost the
// tenant's relay its reputation, from any number of origins.
export const MAIL_LIMIT = 3;
export const MAIL_WINDOW_SECONDS = 3600;
// 100,000 addresses at most, 3 timestamps each: a few tens of megabytes at the
// ceiling. Past it the coldest address is forgotten and gets a fresh budget, as
// ADR 0023 records for the other limiters. The map is per process: restarting
// resets it, and N replicas admit N times the budget.
export const MAIL_MAX_ADDRESSES = 100_000;

export function mailGate(now: () => Date, maxKeys: number = MAIL_MAX_ADDRESSES): MailGate {
  const window = slidingWindow({
    limit: MAIL_LIMIT,
    windowSeconds: MAIL_WINDOW_SECONDS,
    now,
    maxKeys,
  });
  return (tenantId, address) =>
    window.check(createHash('sha256').update(`${tenantId}\0${address.toLowerCase()}`).digest('hex'))
      .allowed;
}
