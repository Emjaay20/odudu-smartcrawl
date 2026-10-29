import { describe, expect, it } from 'vitest';
import { intro, page } from '#/view/document';

describe('page', () => {
  it('links the Instrument stylesheet, declares lang and dir and a viewport', () => {
    const { html } = page('Sign in', '<p>hello</p>');
    expect(html).toContain('<html lang="en" dir="ltr">');
    expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
    expect(html).toContain('<meta name="color-scheme" content="light dark">');
    expect(html).toContain('<link rel="stylesheet" href="/instrument/instrument.css">');
    expect(html).toContain(
      '<link rel="icon" href="/instrument/favicon.svg" type="image/svg+xml">\n<link rel="icon" href="/instrument/favicon.ico" sizes="48x48">',
    );
  });

  it('takes the language and direction from the locale it is given', () => {
    const { html } = page('x', '<p>hello</p>', null, [], { tag: 'ar', dir: 'rtl' });
    expect(html).toContain('<html lang="ar" dir="rtl">');
  });

  it('names the theme the person chose on <html>, and none otherwise', () => {
    const none = page('x', '');
    expect(none.html).not.toContain('data-theme');
    const dark = page('x', '', null, [], { tag: 'en', dir: 'ltr', theme: 'dark' });
    expect(dark.html).toContain('<html lang="en" dir="ltr" data-theme="dark">');
    const light = page('x', '', null, [], { tag: 'ar', dir: 'rtl', theme: 'light' });
    expect(light.html).toContain('<html lang="ar" dir="rtl" data-theme="light">');
  });

  it('never writes a theme that is not one of the two', () => {
    const { html } = page('x', '', null, [], {
      tag: 'en',
      dir: 'ltr',
      theme: 'x"><script>' as never,
    });
    expect(html).not.toContain('data-theme');
    expect(html).not.toContain('<script>');
  });

  it('wraps the body in one main landmark under the brand', () => {
    const { html } = page('Sign in', '<p>hello</p>');
    expect(html.match(/<main /gu)).toHaveLength(1);
    expect(html).toMatch(
      /<main class="page">\s*<p class="brand"><svg class="mark"[^>]*aria-hidden="true"/u,
    );
    expect(html.indexOf('class="mark"')).toBeLessThan(html.indexOf('<p>hello</p>'));
  });

  it('names the product beside the mark, outside the body a theme replaces', () => {
    const rendered = page('Sign in', '<p>hello</p>');
    expect(rendered.html).toContain('<span class="wordmark">SmartCrawl</span></p>');
    expect(rendered.body).not.toContain('wordmark');
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

describe('intro', () => {
  it('is a heading alone when no tenant or context is named', () => {
    expect(intro('Sign in')).toBe('<header class="intro">\n<h1>Sign in</h1>\n</header>');
  });

  it('puts the context lines, then the tenant isolated and escaped, under the heading', () => {
    const html = intro('Sign in', '<acme>&', ['to continue to <bdi>Portal</bdi>']);
    expect(html).toBe(
      '<header class="intro">\n<h1>Sign in</h1>\n' +
        '<p class="context">to continue to <bdi>Portal</bdi></p>\n' +
        '<p class="tenant"><bdi>&lt;acme&gt;&amp;</bdi></p>\n</header>',
    );
  });
});
