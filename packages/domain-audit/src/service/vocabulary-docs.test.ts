import { describe, expect, it } from 'vitest';
import { ADMIN_MUTATION_ACTIONS } from '#/service/admin-mutation-actions';
import {
  ADMIN_MUTATION_ACTION_DOCS,
  AUDIT_ACTION_DOCS,
  AUDIT_EVENT_TYPE_DOCS,
  AUDIT_OUTCOME_DOCS,
  AUDIT_REASON_DOCS,
} from '#/service/vocabulary-docs';
import {
  AUDIT_ACTIONS,
  AUDIT_EVENT_TYPES,
  AUDIT_OUTCOMES,
  AUDIT_REASONS,
} from '#/service/vocabulary';

function oneParagraph(entries: Record<string, string>): void {
  for (const [name, summary] of Object.entries(entries)) {
    expect(summary, name).toMatch(/^\S.*\.$/u);
    expect(summary, name).not.toContain('\n');
  }
}

describe('the audit vocabulary reference', () => {
  it('describes every action of every event type and no other', () => {
    const actions = Object.values(AUDIT_ACTIONS).flat();
    expect(Object.keys(AUDIT_ACTION_DOCS).sort()).toEqual([...actions].sort());
    oneParagraph(AUDIT_ACTION_DOCS);
  });

  it('describes every admin mutation action and no other', () => {
    expect(Object.keys(ADMIN_MUTATION_ACTION_DOCS).sort()).toEqual(
      [...ADMIN_MUTATION_ACTIONS].sort(),
    );
    oneParagraph(ADMIN_MUTATION_ACTION_DOCS);
  });

  it('describes every event type, the free-form one included', () => {
    expect(Object.keys(AUDIT_EVENT_TYPE_DOCS).sort()).toEqual([...AUDIT_EVENT_TYPES].sort());
    oneParagraph(AUDIT_EVENT_TYPE_DOCS);
  });

  it('describes every reason and the three outcomes', () => {
    expect(Object.keys(AUDIT_REASON_DOCS).sort()).toEqual([...AUDIT_REASONS].sort());
    expect(Object.keys(AUDIT_OUTCOME_DOCS).sort()).toEqual([...AUDIT_OUTCOMES].sort());
    oneParagraph(AUDIT_REASON_DOCS);
    oneParagraph(AUDIT_OUTCOME_DOCS);
  });
});
