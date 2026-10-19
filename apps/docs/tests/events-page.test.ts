import { AUDIT_ACTIONS, AUDIT_EVENT_TYPES, AUDIT_REASONS } from '@odudu/domain-audit';
import { ADMIN_MUTATION_ACTIONS } from '@odudu/protocol-admin';
import { describe, expect, it } from 'vitest';
import { renderEventsPage } from '#docs/scripts/events-page.ts';

const text = renderEventsPage();

function has(name: string): boolean {
  return text.split('\n').some((line) => line.startsWith(`| \`${name}\` |`));
}

describe('the audit events reference', () => {
  it('lists every event type, with a section for each that has a fixed vocabulary', () => {
    for (const type of AUDIT_EVENT_TYPES) expect(has(type), type).toBe(true);
    for (const type of Object.keys(AUDIT_ACTIONS)) expect(text, type).toContain(`\n### ${type}\n`);
  });

  it('lists every action under its event type', () => {
    for (const [type, actions] of Object.entries(AUDIT_ACTIONS)) {
      const start = text.indexOf(`\n### ${type}\n`) + 5;
      const section = text.slice(start).split('\n###')[0] ?? '';
      for (const action of actions)
        expect(section, `${type} ${action}`).toContain(`| \`${action}\` |`);
    }
  });

  it('lists every admin mutation and every reason', () => {
    for (const action of Object.keys(ADMIN_MUTATION_ACTIONS))
      expect(has(action), action).toBe(true);
    for (const reason of AUDIT_REASONS) expect(has(reason), reason).toBe(true);
  });
});
