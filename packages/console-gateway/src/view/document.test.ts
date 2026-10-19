import { describe, expect, it } from 'vitest';
import { page } from '#/view/document';

describe('page', () => {
  it('links the Instrument stylesheet, declares lang and dir and a viewport', () => {
    const { html } = page('Sign in', '<p>hello</p>');
    expect(html).toContain('<html lang="en" dir="ltr">');
    expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
    expect(html).toContain('<meta name="color-scheme" content="light dark">');
    expect(html).toContain('<link rel="stylesheet" href="/instrument/instrument.css">');
    expect(html).toContain('<link rel="icon" href="/instrument/mark.svg" type="image/svg+xml">');
  });

  it('takes the language and direction from the locale it is given', () => {
    const { html } = page('x', '<p>hello</p>', null, [], { tag: 'ar', dir: 'rtl' });
    expect(html).toContain('<html lang="ar" dir="rtl">');
  });

  it('wraps the body in one main landmark under the mark', () => {
    const { html } = page('Sign in', '<p>hello</p>');
    expect(html.match(/<main /gu)).toHaveLength(1);
    expect(html).toMatch(/<main class="page">\s*<svg class="mark"[^>]*aria-hidden="true"/u);
    expect(html.indexOf('class="mark"')).toBeLessThan(html.indexOf('<p>hello</p>'));
  });

  it('keeps the body a theme may replace free of the document chrome', () => {
    const rendered = page('Sign in', '<p>hello</p>');
    expect(rendered.body).toBe('<p>hello</p>');
    expect(rendered.body).not.toMatch(/<link|<html|<head|<main|<svg/u);
  });

  it('puts no inline style or script in the shell', () => {
    const { html } = page('Sign in', '');
    expect(html).not.toMatch(/<style|style=|<script|onerror=/u);
  });

  it('escapes the title', () => {
    const { html } = page('<img src=x onerror=1>', '');
    expect(html).toContain('<title>&lt;img src=x onerror=1&gt;</title>');
  });

  it('escapes a hostile locale tag', () => {
    const { html } = page('x', '', null, [], { tag: 'en"><script>', dir: 'ltr' });
    expect(html).not.toContain('<script>');
  });
});
