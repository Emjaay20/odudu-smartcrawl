import type { MessageCatalogueResponse } from '@odudu/contracts/admin';
import { describe, expect, it } from 'vitest';
import {
  allMessages,
  messageOptions,
  messagesOf,
  messagesForKind,
  SHORT_TEXT_LENGTH,
  templateReference,
} from '#/features/branding/service/catalogue';

const CATALOGUE: MessageCatalogueResponse = {
  sections: [
    {
      kinds: ['sign-in', 'consent'],
      messages: [
        { key: 'login.title', en: 'Sign in' },
        { key: 'shared.cancel', en: 'Cancel' },
      ],
    },
    {
      kinds: ['registration'],
      messages: [
        { key: 'register.title', en: 'Create an account' },
        { key: 'shared.cancel', en: 'Cancel registration' },
      ],
    },
  ],
};

describe('messagesForKind', () => {
  it('is the section that fills the kind, and nothing of another', () => {
    expect(messagesForKind(CATALOGUE, 'consent').map((m) => m.key)).toEqual([
      'login.title',
      'shared.cancel',
    ]);
    expect(messagesForKind(CATALOGUE, 'registration').map((m) => m.key)).toEqual([
      'register.title',
      'shared.cancel',
    ]);
  });

  it('is empty for a kind no section fills', () => {
    expect(messagesForKind(CATALOGUE, 'notice')).toEqual([]);
  });
});

describe('allMessages', () => {
  it('lists every key once, in key order, with the first section’s text', () => {
    expect(allMessages(CATALOGUE)).toEqual([
      { key: 'login.title', text: 'Sign in' },
      { key: 'register.title', text: 'Create an account' },
      { key: 'shared.cancel', text: 'Cancel' },
    ]);
  });
});

describe('templateReference', () => {
  it('is the slot a template writes for a message', () => {
    expect(templateReference('login.title')).toBe('{{t "login.title"}}');
  });
});

describe('messageOptions', () => {
  it('names each option by its key and shows the text beside it, shortened when long', () => {
    const long = 'x'.repeat(SHORT_TEXT_LENGTH + 50);
    const options = messageOptions([
      { key: 'a.b', text: 'Sign in' },
      { key: 'c.d', text: long },
    ]);
    expect(options[0]).toEqual({ id: 'a.b', label: 'a.b', detail: 'Sign in' });
    expect(options[1]?.detail.length).toBe(SHORT_TEXT_LENGTH);
    expect(options[1]?.detail.endsWith('…')).toBe(true);
  });

  it('collapses a text that runs over lines to one line', () => {
    expect(messageOptions([{ key: 'a', text: 'one\n  two' }])[0]?.detail).toBe('one two');
  });
});

describe('messagesOf', () => {
  it('is a kind’s own messages, or every message with no kind', () => {
    expect(messagesOf(CATALOGUE, 'registration').map((m) => m.key)).toEqual([
      'register.title',
      'shared.cancel',
    ]);
    expect(messagesOf(CATALOGUE, null)).toHaveLength(3);
  });
});
