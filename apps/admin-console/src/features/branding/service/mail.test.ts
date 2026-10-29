import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAIL_CHOICE,
  logoViews,
  mailChoiceWith,
  mailFrameKey,
  mailLocaleOf,
  MAIL_LOCALE_OPTIONS,
  paletteRows,
  sourceText,
} from '#/features/branding/service';
import { mailBranding } from '#/testing/brandingFixtures';

describe('the mail palette', () => {
  it('lists all nine roles, each with its colour', () => {
    const rows = paletteRows(mailBranding().light.colours);
    expect(rows).toHaveLength(9);
    expect(rows.find((row) => row.role === 'panel')?.colour).toBe('#fafafa');
    expect(rows.find((row) => row.role === 'button_ink')?.label).toBe('Button text');
  });

  it('names who supplies it', () => {
    expect(sourceText('tenant')).toMatch(/published theme/u);
    expect(sourceText('default')).toMatch(/default/u);
  });
});

describe('the logos', () => {
  it('say what a missing one means', () => {
    const [light, dark] = logoViews(mailBranding({ logo: null }));
    expect(light?.src).toBeNull();
    expect(light?.empty).toMatch(/Odudu’s own mark/u);
    expect(dark?.empty).toMatch(/light logo is shown/u);
  });

  it('say the size a mail draws a logo at', () => {
    expect(logoViews(mailBranding())[0]?.size).toBe('160 by 32 pixels');
  });
});

describe('the preview', () => {
  it('asks for the tenant’s language unless one is chosen, and only for languages that ship', () => {
    expect(DEFAULT_MAIL_CHOICE.locale).toBe('');
    expect(MAIL_LOCALE_OPTIONS.map((option) => option.id)).toEqual(['', 'en', 'ar']);
    expect(mailLocaleOf('ar')).toBe('ar');
    expect(mailLocaleOf('fr')).toBeUndefined();
  });

  it('reloads the frame when the theme is published or the choice changes', () => {
    const base = mailFrameKey(1, DEFAULT_MAIL_CHOICE);
    expect(mailFrameKey(2, DEFAULT_MAIL_CHOICE)).not.toBe(base);
    expect(mailFrameKey(1, mailChoiceWith(DEFAULT_MAIL_CHOICE, { scheme: 'dark' }))).not.toBe(base);
    expect(mailFrameKey(1, mailChoiceWith(DEFAULT_MAIL_CHOICE, { locale: 'ar' }))).not.toBe(base);
  });
});
