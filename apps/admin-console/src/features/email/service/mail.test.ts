import type { MailMessage } from '@odudu/contracts/admin';
import { describe, expect, it } from 'vitest';
import {
  anyMasked,
  mailOutcome,
  mailQuery,
  mailTone,
  MAIL_PAGE_SIZE,
  MAIL_STATUS_OPTIONS,
  oldestWaiting,
} from '#/features/email/service/mail';

function message(id: string, status: MailMessage['status'], extra: Partial<MailMessage> = {}) {
  return {
    id,
    to: 'a***@example.org',
    to_masked: true,
    subject: 'Verify your Acme account',
    status,
    attempts: 0,
    last_error: null,
    created_at: `2026-10-1${id}T08:00:00.000Z`,
    next_attempt_at: '2026-10-15T09:00:00.000Z',
    sent_at: null,
    ...extra,
  } satisfies MailMessage;
}

describe('the request the panel makes', () => {
  it('asks for one bounded page, narrowed to a status only when one is chosen', () => {
    expect(mailQuery(null)).toEqual({ limit: String(MAIL_PAGE_SIZE) });
    expect(mailQuery('failed')).toEqual({ limit: String(MAIL_PAGE_SIZE), status: 'failed' });
    expect(MAIL_PAGE_SIZE).toBeLessThanOrEqual(50);
  });

  it('offers every status the server reports, and any', () => {
    expect(MAIL_STATUS_OPTIONS.map((option) => option.id)).toEqual([
      'any',
      'queued',
      'retrying',
      'failed',
      'sent',
    ]);
  });
});

describe('how a status is drawn', () => {
  it('shows a failed message as danger, one still being tried as a warning and one sent as active', () => {
    expect(mailTone('failed')).toBe('danger');
    expect(mailTone('retrying')).toBe('warning');
    expect(mailTone('queued')).toBe('neutral');
    expect(mailTone('sent')).toBe('active');
  });
});

describe('what became of a message', () => {
  it('says when it was sent, when the next attempt is due, or that every attempt is spent', () => {
    expect(mailOutcome(message('1', 'sent', { sent_at: '2026-10-11T08:01:00.000Z' }))).toEqual({
      kind: 'sent',
      at: '2026-10-11T08:01:00.000Z',
    });
    expect(mailOutcome(message('2', 'queued'))).toEqual({
      kind: 'next',
      at: '2026-10-15T09:00:00.000Z',
    });
    expect(mailOutcome(message('3', 'retrying'))).toMatchObject({ kind: 'next' });
    expect(mailOutcome(message('4', 'failed'))).toEqual({ kind: 'given-up' });
  });
});

describe('the oldest message still waiting', () => {
  it('is the last waiting one of a list that is complete', () => {
    const rows = [message('3', 'queued'), message('2', 'sent'), message('1', 'retrying')];
    expect(oldestWaiting(rows, false)).toBe('2026-10-11T08:00:00.000Z');
  });

  it('is unknown while more messages are left unread, and none when nothing waits', () => {
    expect(oldestWaiting([message('3', 'queued')], true)).toBeNull();
    expect(oldestWaiting([message('3', 'sent'), message('2', 'failed')], false)).toBeNull();
    expect(oldestWaiting([], false)).toBeNull();
  });
});

describe('whether an address is masked', () => {
  it('is true when any listed recipient is', () => {
    expect(anyMasked([message('1', 'sent', { to_masked: false }), message('2', 'sent')])).toBe(
      true,
    );
    expect(anyMasked([message('1', 'sent', { to_masked: false })])).toBe(false);
    expect(anyMasked([])).toBe(false);
  });
});
