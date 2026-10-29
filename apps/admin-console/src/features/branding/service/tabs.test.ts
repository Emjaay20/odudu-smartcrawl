import { describe, expect, it } from 'vitest';
import {
  BRANDING_TAB_LABELS,
  BRANDING_TABS,
  OFFERED_TABS,
  tabsWithEdits,
  themeRecord,
  themeParts,
  tagOf,
  ifMatchOf,
  NO_DRAFT_TAG,
} from '#/features/branding/service';

describe('the tabs', () => {
  it('keep the order Theme, Pages, Mail, Languages, each with a view', () => {
    expect(BRANDING_TABS).toEqual(['theme', 'pages', 'mail', 'languages']);
    expect(OFFERED_TABS).toEqual(BRANDING_TABS);
    expect(Object.keys(BRANDING_TAB_LABELS)).toEqual([...BRANDING_TABS]);
  });

  it('carry a dot when a section they hold has unsaved edits', () => {
    expect([...tabsWithEdits(new Set(['images']))]).toEqual(['theme']);
    expect([...tabsWithEdits(new Set(['stylesheet']))]).toEqual(['theme']);
    expect([...tabsWithEdits(new Set(['templates']))]).toEqual(['pages']);
    expect([...tabsWithEdits(new Set())]).toEqual([]);
  });
});

describe('the scope', () => {
  it('finds the tenant’s theme beside it and a client’s under the client', () => {
    expect(themeParts({ kind: 'tenant' })).toEqual(['theme']);
    expect(themeParts({ kind: 'client', id: 'c1' })).toEqual(['clients', 'c1', 'theme']);
    expect(themeRecord({ kind: 'client', id: 'c1' })).toBe('clients/c1/theme');
  });

  it('sends no If-Match for a theme with no draft', () => {
    expect(tagOf(null)).toBe(NO_DRAFT_TAG);
    expect(ifMatchOf(NO_DRAFT_TAG)).toBeUndefined();
    expect(ifMatchOf('"d1"')).toBe('"d1"');
  });
});
