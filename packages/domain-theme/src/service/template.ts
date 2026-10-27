import {
  MAX_TEMPLATE_LENGTH,
  PAGE_KINDS,
  scanSlots,
  type PageKind,
  type PageManifest,
} from '@odudu/kernel';
import { defaultTreeAdapter, html, parseFragment, type DefaultTreeAdapterMap } from 'parse5';

type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];

// Slot and element bounds keep a save's work linear in a small input.
export const MAX_TEMPLATE_SLOTS = 200;
export const MAX_TEMPLATE_DEPTH = 32;
export const MAX_TEMPLATE_ELEMENTS = 2000;
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
  | 'img-alt'
  | 'unterminated'
  | 'unparsed-tag'
  | 'too-deep'
  | 'too-many-elements'
  | 'form-pair'
  | 'form-placement';

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

const TAG_NAME = /<(\/?)([a-zA-Z][^\s/>]*)/g;
const VOID_ELEMENTS: ReadonlySet<string> = new Set(['br', 'hr', 'img', 'wbr']);
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

// A page nobody can submit is refused at save: the pair comes in order,
// together, and holds the parts that belong inside it.
function checkForm(
  manifest: PageManifest,
  slots: ReturnType<typeof scanSlots>,
  add: (code: TemplateIssueCode, detail: string) => void,
): void {
  const at = (name: string): number[] =>
    slots.filter((slot) => slot.kind === 'part' && slot.name === name).map((slot) => slot.index);
  const [open, close] = [at('form.open'), at('form.close')];
  const first = open[0];
  const last = close[0];
  if (open.length !== close.length) add('form-pair', 'form.open and form.close come together');
  else if (first !== undefined && last !== undefined && first > last) {
    add('form-pair', 'form.open comes before form.close');
  }
  for (const name of manifest.inForm) {
    for (const index of at(name)) {
      const inside = first !== undefined && last !== undefined && index > first && index < last;
      if (!inside) add('form-placement', name);
    }
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
  checkForm(manifest, slots, add);
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
// `{{t "key"}}` keys are not checked against a catalogue here; the `t`
// callback given to fillTemplate decides what an unknown key does.
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
  // page's) is refused by name rather than trusted to stay dropped. The same
  // linear scan bounds nesting and element count before the parser, whose
  // cost grows faster than the input, is given the template. An end tag that
  // does not close the innermost open one is not counted, so this never
  // reads shallower than the tree; the tree's own depth is checked below.
  const sourceTags: number[] = [];
  const open: string[] = [];
  let elements = 0;
  for (const match of template.matchAll(TAG_NAME)) {
    const name = (match[2] ?? '').toLowerCase();
    if (!ALLOWED_ELEMENTS.has(name)) add('element-not-allowed', name);
    if (match[1] === '/') {
      if (open[open.length - 1] === name) open.pop();
      continue;
    }
    elements += 1;
    sourceTags.push(match.index);
    if (!VOID_ELEMENTS.has(name)) open.push(name);
    if (open.length > MAX_TEMPLATE_DEPTH) {
      add('too-deep', String(MAX_TEMPLATE_DEPTH));
      return issues;
    }
    if (elements > MAX_TEMPLATE_ELEMENTS) {
      add('too-many-elements', String(MAX_TEMPLATE_ELEMENTS));
      return issues;
    }
  }

  const body = defaultTreeAdapter.createElement('body', html.NS.HTML, []);
  // A tag left open at the end would swallow the markup the server puts
  // after the template, so any end-of-input error refuses the template.
  const fragment = parseFragment(body, template, {
    sourceCodeLocationInfo: true,
    onParseError: (error) => {
      if (error.code.startsWith('eof-')) add('unterminated', error.code);
    },
  });
  // Where each element's own start tag begins; an element the parser made up
  // (an implied tbody) has none.
  const explicit = new Set<number>();
  // Slots the parser saw in text. A slot written with entities, or one a
  // tag splits, never matches the source's count.
  let slotsInText = 0;
  const stack: { node: Node; depth: number }[] = fragment.childNodes.map((node) => ({
    node,
    depth: 1,
  }));
  while (stack.length > 0) {
    const entry = stack.pop();
    if (entry === undefined) break;
    const { node, depth } = entry;
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
      const startTag = node.sourceCodeLocation?.startTag;
      if (startTag !== undefined) explicit.add(startTag.startOffset);
      if (depth > MAX_TEMPLATE_DEPTH) {
        add('too-deep', String(MAX_TEMPLATE_DEPTH));
        continue;
      }
      if (node.namespaceURI !== html.NS.HTML || !ALLOWED_ELEMENTS.has(node.tagName)) {
        add('element-not-allowed', node.tagName);
      } else {
        checkAttributes(node, options, add);
      }
      for (const child of node.childNodes) stack.push({ node: child, depth: depth + 1 });
    }
  }
  for (const offset of sourceTags) {
    if (!explicit.has(offset)) add('unparsed-tag', template.slice(offset, offset + 16));
  }
  const slotsInSource = slots.filter((slot) => slot.kind !== 'malformed').length;
  // Only when nothing else was found: a slot in an attribute or a comment
  // also lowers the text count, and its own issue already says so.
  if (slotsInText !== slotsInSource && issues.length === 0) {
    add('malformed-slot', 'a slot the parser does not read as text');
  }
  return issues;
}
