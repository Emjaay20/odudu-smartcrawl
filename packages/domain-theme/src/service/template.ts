import { MAX_TEMPLATE_LENGTH, PAGE_KINDS, scanSlots, type PageKind } from '@odudu/kernel';
import { defaultTreeAdapter, html, parseFragment, type DefaultTreeAdapterMap } from 'parse5';

type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];

export const MAX_TEMPLATE_SLOTS = 200;
const MAX_ISSUES = 100;

export type TemplateIssueCode =
  | 'too-large'
  | 'too-many-slots'
  | 'malformed-slot'
  | 'unknown-slot'
  | 'missing-part'
  | 'repeated-part'
  | 'slot-in-attribute'
  | 'slot-in-raw-text'
  | 'comment'
  | 'element-not-allowed'
  | 'attribute-not-allowed'
  | 'href-not-https'
  | 'link-rel'
  | 'img-src'
  | 'img-alt';

export interface TemplateIssue {
  code: TemplateIssueCode;
  detail: string;
}

export interface TemplateOptions {
  // Whether a URL names one of the theme's own uploaded assets. Without it
  // no <img src> is acceptable.
  isAssetUrl?: (url: string) => boolean;
}

// Anything not listed is refused. Form controls, scripts, styles, embeds
// and foreign content are absent on purpose; the server emits every one of
// those itself, as parts.
const ALLOWED_ELEMENTS: ReadonlySet<string> = new Set([
  'a',
  'abbr',
  'address',
  'article',
  'aside',
  'b',
  'bdi',
  'bdo',
  'blockquote',
  'br',
  'caption',
  'cite',
  'code',
  'dd',
  'div',
  'dl',
  'dt',
  'em',
  'figcaption',
  'figure',
  'footer',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'i',
  'img',
  'li',
  'mark',
  'nav',
  'ol',
  'p',
  'q',
  's',
  'section',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'time',
  'tr',
  'u',
  'ul',
  'wbr',
]);

// Elements whose content the parser reads as text. Tested by tag name in
// every namespace, because the parser leaves svg's own style, script and
// title as ordinary children rather than raw text.
const RAW_TEXT: ReadonlySet<string> = new Set([
  'title',
  'textarea',
  'style',
  'script',
  'noscript',
  'xmp',
  'iframe',
  'noembed',
  'noframes',
  'plaintext',
]);

const ELEMENT_ATTRIBUTES: Readonly<Record<string, readonly string[]>> = {
  a: ['href', 'rel'],
  img: ['src', 'alt'],
};
const GLOBAL_ATTRIBUTES: ReadonlySet<string> = new Set(['class', 'lang', 'dir', 'role']);

const TAG_NAME = /<\/?([a-zA-Z][^\s/>]*)/g;
const HAS_BRACES = /\{\{|\}\}/;

function isHttps(value: string): boolean {
  if (!/^https:/i.test(value) || /[\u0000- \u007f]/.test(value)) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function relTokens(value: string | undefined): string[] {
  return (value ?? '').toLowerCase().split(/\s+/).filter(Boolean);
}

function checkAttributes(
  element: Element,
  options: TemplateOptions,
  add: (code: TemplateIssueCode, detail: string) => void,
): void {
  const tag = element.tagName;
  const allowedHere = ELEMENT_ATTRIBUTES[tag] ?? [];
  const value = (name: string): string | undefined =>
    element.attrs.find((attr) => attr.name === name)?.value;
  for (const { name, value: attrValue } of element.attrs) {
    if (HAS_BRACES.test(name) || HAS_BRACES.test(attrValue)) {
      add('slot-in-attribute', `${tag} ${name}`);
    } else if (
      !GLOBAL_ATTRIBUTES.has(name) &&
      !/^aria-[a-z]+(?:-[a-z]+)*$/.test(name) &&
      !allowedHere.includes(name)
    ) {
      add('attribute-not-allowed', `${tag} ${name}`);
    }
  }
  if (tag === 'a') {
    const href = value('href');
    if (href === undefined || !isHttps(href)) add('href-not-https', 'a href');
    const rel = relTokens(value('rel'));
    if (!rel.includes('noopener') || !rel.includes('noreferrer')) add('link-rel', 'a rel');
  }
  if (tag === 'img') {
    const src = value('src');
    if (src === undefined || options.isAssetUrl?.(src) !== true) add('img-src', 'img src');
    if (value('alt') === undefined) add('img-alt', 'img alt');
  }
}

function checkManifest(
  kind: PageKind,
  slots: ReturnType<typeof scanSlots>,
  add: (code: TemplateIssueCode, detail: string) => void,
): void {
  const manifest = PAGE_KINDS[kind];
  const counts = new Map<string, number>();
  for (const slot of slots) {
    if (slot.kind === 'malformed') {
      add('malformed-slot', `at ${String(slot.index)}`);
    } else if (slot.kind === 'part') {
      counts.set(slot.name, (counts.get(slot.name) ?? 0) + 1);
    }
  }
  for (const name of counts.keys()) {
    if (!manifest.required.includes(name) && !manifest.optional.includes(name)) {
      add('unknown-slot', name);
    }
  }
  for (const name of manifest.required) {
    if (!counts.has(name)) add('missing-part', name);
  }
  for (const [name, count] of counts) {
    if (count > 1 && (manifest.required.includes(name) || manifest.optional.includes(name))) {
      add('repeated-part', name);
    }
  }
}

// Fail closed: a template is accepted only if every element, attribute and
// slot in it is recognised. The tree is read, never serialised back out, so
// what is checked is what the parser saw and the template text itself is
// what gets filled.
export function checkTemplate(
  kind: PageKind,
  template: string,
  options: TemplateOptions = {},
): TemplateIssue[] {
  const issues: TemplateIssue[] = [];
  const add = (code: TemplateIssueCode, detail: string): void => {
    const seen = issues.some((issue) => issue.code === code && issue.detail === detail);
    if (!seen && issues.length < MAX_ISSUES) issues.push({ code, detail });
  };
  if (template.length > MAX_TEMPLATE_LENGTH) {
    add('too-large', `${String(template.length)} characters`);
    return issues;
  }
  const slots = scanSlots(template);
  if (slots.length > MAX_TEMPLATE_SLOTS) {
    add('too-many-slots', String(slots.length));
    return issues;
  }
  checkManifest(kind, slots, add);

  // The source is what gets filled, so a tag the parser would drop in this
  // context (frame, a second body whose attributes would be merged onto the
  // page's) is refused by name rather than trusted to stay dropped.
  for (const match of template.matchAll(TAG_NAME)) {
    const name = (match[1] ?? '').toLowerCase();
    if (!ALLOWED_ELEMENTS.has(name)) add('element-not-allowed', name);
  }

  const body = defaultTreeAdapter.createElement('body', html.NS.HTML, []);
  const fragment = parseFragment(body, template, {});
  // Slots the parser saw in text. A slot written with entities, or one a
  // tag splits, never matches the source's count.
  let slotsInText = 0;
  const stack: Node[] = [...fragment.childNodes];
  while (stack.length > 0) {
    const node = stack.pop();
    if (node === undefined) break;
    if (defaultTreeAdapter.isCommentNode(node)) {
      add('comment', 'comments are not allowed');
    } else if (defaultTreeAdapter.isTextNode(node)) {
      const parent = node.parentNode;
      const inRawText =
        parent !== null && defaultTreeAdapter.isElementNode(parent) && RAW_TEXT.has(parent.tagName);
      if (inRawText && HAS_BRACES.test(node.value)) {
        add('slot-in-raw-text', parent.tagName);
      } else if (!inRawText) {
        slotsInText += scanSlots(node.value).filter((slot) => slot.kind !== 'malformed').length;
      }
    } else if (defaultTreeAdapter.isElementNode(node)) {
      if (node.namespaceURI !== html.NS.HTML || !ALLOWED_ELEMENTS.has(node.tagName)) {
        add('element-not-allowed', node.tagName);
      } else {
        checkAttributes(node, options, add);
      }
      stack.push(...node.childNodes);
    }
  }
  const slotsInSource = slots.filter((slot) => slot.kind !== 'malformed').length;
  if (slotsInText !== slotsInSource && issues.length === 0) {
    add('malformed-slot', 'a slot the parser does not read as text');
  }
  return issues;
}
