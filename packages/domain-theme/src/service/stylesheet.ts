import {
  parse,
  type AtRule,
  type ChildNode,
  type Declaration,
  type Node,
  type Rule,
} from 'postcss';
import valueParser from 'postcss-value-parser';
import { CSS_ELEMENTS, CSS_HOOKS, CSS_TOKENS } from '#/service/hooks';

export const MAX_STYLESHEET_BYTES = 128 * 1024;
export const MAX_RULES = 2000;
export const MAX_DECLARATIONS = 10_000;
export const MAX_SELECTORS = 10;
export const MAX_SELECTOR_LENGTH = 200;
export const MAX_VALUE_LENGTH = 4096;
const MAX_ISSUES = 100;
const MAX_FUNCTION_DEPTH = 4;
const MAX_PARAMS_LENGTH = 200;

export type StylesheetIssueCode =
  | 'too-large'
  | 'unparsable'
  | 'nul-byte'
  | 'root-declaration'
  | 'at-rule-not-allowed'
  | 'media-query-not-allowed'
  | 'selector-not-allowed'
  | 'unknown-class'
  | 'property-not-allowed'
  | 'value-not-allowed'
  | 'url-not-allowed'
  | 'too-many-rules'
  | 'too-many-declarations'
  | 'too-long'
  | 'too-many-issues';

export interface StylesheetIssue {
  code: StylesheetIssueCode;
  detail: string;
  // 1-based, columns in UTF-16 code units; null when the issue has no
  // single place (too large, too many).
  line: number | null;
  column: number | null;
}

export interface StylesheetOptions {
  // Whether a URL names one of the theme's own uploaded assets. Without it
  // no url() is acceptable.
  isAssetUrl?: (url: string) => boolean;
}

type Add = (code: StylesheetIssueCode, detail: string, node?: Node) => void;

const set = (words: string): ReadonlySet<string> => new Set(words.split(' '));

const HOOKS: ReadonlySet<string> = new Set(CSS_HOOKS);
const ELEMENTS: ReadonlySet<string> = new Set(CSS_ELEMENTS);
const TOKENS: ReadonlySet<string> = new Set(CSS_TOKENS);
const PSEUDO_CLASSES = set(
  'hover focus focus-visible active disabled checked first-child last-child',
);
const PSEUDO_ELEMENTS = set('before after placeholder');

// A tenant must not be able to take the way to submit away. A selector
// that names one of these, or an element that wraps them, never gets
// display: none; neither does one that names no element at all, since a
// class such as .page is the form's own wrapper.
const CONTROL_ELEMENTS = set('button input form label main div section');
const HIDEABLE_ELEMENTS = set('img small span code p h1 h2 h3 ul ol li a header footer');

// ---- selectors -----------------------------------------------------------

interface Compound {
  element: string | null;
}

const CSS_SPACE = '[ \\t\\r\\n\\f]';
const ELEMENT = /[A-Za-z][A-Za-z0-9]*/y;
const CLASS = /\.([A-Za-z_][A-Za-z0-9_-]*)/y;
const PSEUDO = /(::?)([A-Za-z][A-Za-z-]*)/y;
const COMBINATOR = new RegExp(`${CSS_SPACE}*([>+~])${CSS_SPACE}*|${CSS_SPACE}+`, 'y');
const TRIM = new RegExp(`^${CSS_SPACE}+|${CSS_SPACE}+$`, 'g');

interface Problem {
  code: StylesheetIssueCode;
  detail: string;
}

function match(pattern: RegExp, text: string, at: number): RegExpExecArray | null {
  pattern.lastIndex = at;
  return pattern.exec(text);
}

// One compound selector at `from`. Returns where it ended, or a problem.
function readCompound(
  text: string,
  from: number,
): { end: number; compound: Compound; last: boolean } | Problem {
  let at = from;
  let element: string | null = null;
  let any = false;
  let last = false;
  const head = match(ELEMENT, text, at);
  if (head !== null) {
    element = head[0].toLowerCase();
    if (!ELEMENTS.has(element)) return { code: 'selector-not-allowed', detail: head[0] };
    at += head[0].length;
    any = true;
  }
  for (;;) {
    if (last && at < text.length && text[at] !== ' ') {
      return { code: 'selector-not-allowed', detail: 'nothing may follow a pseudo-element' };
    }
    const found = text[at] === '.' ? match(CLASS, text, at) : null;
    if (found !== null) {
      const name = found[1] ?? '';
      if (!HOOKS.has(name)) return { code: 'unknown-class', detail: name };
      at += found[0].length;
      any = true;
      continue;
    }
    const pseudo = text[at] === ':' ? match(PSEUDO, text, at) : null;
    if (pseudo === null) break;
    const name = (pseudo[2] ?? '').toLowerCase();
    if (pseudo[1] === '::') {
      if (!PSEUDO_ELEMENTS.has(name)) return { code: 'selector-not-allowed', detail: pseudo[0] };
      last = true;
    } else if (!PSEUDO_CLASSES.has(name)) {
      return { code: 'selector-not-allowed', detail: pseudo[0] };
    }
    at += pseudo[0].length;
    any = true;
  }
  if (!any) {
    return { code: 'selector-not-allowed', detail: `unexpected ${JSON.stringify(text[at] ?? '')}` };
  }
  return { end: at, compound: { element }, last };
}

// A complex selector made only of hooks and listed element types. Written as
// anchored, sticky scans so the work is linear in a bounded input.
function readSelector(raw: string): Compound[] | Problem {
  if (/[^ -~\t\n\r\f]|\\/.test(raw)) {
    return { code: 'selector-not-allowed', detail: 'an escape or a non-ASCII character' };
  }
  const text = raw.replace(TRIM, '');
  const compounds: Compound[] = [];
  let at = 0;
  for (;;) {
    const read = readCompound(text, at);
    if (!('compound' in read)) return read;
    compounds.push(read.compound);
    at = read.end;
    if (at >= text.length) return compounds;
    if (read.last)
      return { code: 'selector-not-allowed', detail: 'a pseudo-element ends a selector' };
    const joint = match(COMBINATOR, text, at);
    if (joint === null) {
      return { code: 'selector-not-allowed', detail: `unexpected ${JSON.stringify(text[at])}` };
    }
    at += joint[0].length;
    if (at >= text.length) return { code: 'selector-not-allowed', detail: 'trailing combinator' };
  }
}

function mayBeHidden(selectors: Compound[][]): boolean {
  return selectors.every((compounds) => {
    const subject = compounds[compounds.length - 1]?.element ?? null;
    return (
      subject !== null &&
      HIDEABLE_ELEMENTS.has(subject) &&
      compounds.every((c) => c.element === null || !CONTROL_ELEMENTS.has(c.element))
    );
  });
}

// ---- values --------------------------------------------------------------

const COLOURS = set(
  'black silver gray grey white maroon red purple fuchsia green lime olive yellow navy blue teal aqua orange transparent currentcolor inherit initial unset',
);
const KEYWORDS = set(
  [
    'none auto normal bold bolder lighter italic oblique solid dashed dotted double groove ridge',
    'inset outset hidden left right center start end justify top bottom uppercase lowercase',
    'capitalize underline overline line-through nowrap pre pre-wrap pre-line break-all keep-all',
    'break-word disc circle square decimal inside outside flex-start flex-end space-between',
    'space-around space-evenly stretch baseline row column wrap wrap-reverse row-reverse',
    'column-reverse cover contain fill scale-down no-repeat repeat repeat-x repeat-y medium thin',
    'thick min-content max-content fit-content xx-small x-small small large x-large xx-large',
    'smaller larger inline-flex',
  ].join(' '),
);
const DISPLAY = set('block inline inline-block flex grid none');
const POSITION = set('static relative');
const OVERFLOW = set('visible hidden auto');
const CURSOR = set('auto default pointer text not-allowed help wait progress');
const FONT_FAMILY_NAMES: ReadonlySet<string> = new Set([
  'ibm plex sans',
  'ibm plex mono',
  'system-ui',
  'sans-serif',
  'monospace',
  'serif',
]);

const NUMBER = /^([+-]?)(\d+\.?\d*|\.\d+)(px|em|rem|%|ch|fr|deg)?$/;
const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/;
const COLOUR_FUNCTIONS = set('rgb rgba hsl hsla');
const URL_LIKE = set('url image-set -webkit-image-set src image cross-fade element paint');
const URL_PROPERTIES = set('background background-image');

// Units are a fixed list with no viewport units; a negative length is
// refused everywhere but letter-spacing, so a tenant cannot pull a control
// off the page with a negative margin.
function decodeEscapes(text: string): string {
  return text.replace(
    /\\(?:([0-9a-fA-F]{1,6})[ \t\r\n\f]?|([^\n]))/g,
    (_all, hex?: string, char?: string) => {
      if (char !== undefined) return char;
      const code = Number.parseInt(hex ?? '0', 16);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '\ufffd';
    },
  );
}

type ValueNode = ReturnType<typeof valueParser>['nodes'][number];

interface ValueContext {
  property: string;
  isAssetUrl: ((url: string) => boolean) | undefined;
  refuse: (code: StylesheetIssueCode, detail: string) => void;
}

function meaningful(nodes: ValueNode[]): ValueNode[] {
  return nodes.filter((n) => n.type !== 'space' && n.type !== 'comment');
}

function checkUrl(node: Extract<ValueNode, { type: 'function' }>, ctx: ValueContext): void {
  const parts = meaningful(node.nodes);
  const only = parts.length === 1 ? parts[0] : undefined;
  const arg =
    only !== undefined && (only.type === 'string' || only.type === 'word')
      ? only.value
      : valueParser.stringify(node.nodes).trim();
  const fine =
    decodeEscapes(node.value).toLowerCase() === 'url' &&
    URL_PROPERTIES.has(ctx.property) &&
    !arg.includes('\\') &&
    ctx.isAssetUrl?.(arg) === true;
  if (!fine) ctx.refuse('url-not-allowed', 'url()');
}

function checkWord(word: string, ctx: ValueContext, inColourFunction: boolean): void {
  const lower = word.toLowerCase();
  const number = NUMBER.exec(lower);
  if (number !== null) {
    const unitOk = number[3] !== 'deg' || inColourFunction;
    const signOk = number[1] !== '-' || ctx.property === 'letter-spacing';
    if (unitOk && signOk) return;
  } else if (HEX.test(lower) || COLOURS.has(lower) || KEYWORDS.has(lower)) {
    return;
  }
  ctx.refuse('value-not-allowed', word.slice(0, 40));
}

function checkNodes(
  nodes: ValueNode[],
  ctx: ValueContext,
  depth: number,
  inColourFunction: boolean,
): void {
  for (const node of nodes) {
    if (node.type === 'space' || node.type === 'comment') continue;
    if (node.type === 'div') {
      if (node.value !== ',' && node.value !== '/') ctx.refuse('value-not-allowed', node.value);
    } else if (node.type === 'word') {
      checkWord(node.value, ctx, inColourFunction);
    } else if (node.type === 'function') {
      checkFunction(node, ctx, depth);
    } else {
      ctx.refuse('value-not-allowed', node.type);
    }
  }
}

function checkFunction(
  node: Extract<ValueNode, { type: 'function' }>,
  ctx: ValueContext,
  depth: number,
): void {
  const name = decodeEscapes(node.value).toLowerCase();
  if (node.unclosed === true || depth >= MAX_FUNCTION_DEPTH) {
    ctx.refuse('value-not-allowed', `${name}(`);
  } else if (URL_LIKE.has(name)) {
    checkUrl(node, ctx);
  } else if (node.value.includes('\\')) {
    ctx.refuse('value-not-allowed', 'escape in a function name');
  } else if (name === 'var') {
    const only = node.nodes.length === 1 ? node.nodes[0] : undefined;
    if (only?.type !== 'word' || !TOKENS.has(only.value)) {
      ctx.refuse('value-not-allowed', 'var()');
    }
  } else if (COLOUR_FUNCTIONS.has(name)) {
    checkNodes(node.nodes, ctx, depth + 1, true);
  } else {
    ctx.refuse('value-not-allowed', `${name}()`);
  }
}

// Properties with their own grammar. Anything else is checked as a list of
// lengths, colours and keywords.
type Special = (nodes: ValueNode[], ctx: ValueContext) => void;

const oneOf =
  (allowed: ReadonlySet<string>): Special =>
  (nodes, ctx) => {
    const parts = meaningful(nodes);
    const only = parts[0];
    const word = only?.type === 'word' ? only.value.toLowerCase() : '';
    if (parts.length !== 1 || !allowed.has(word)) {
      ctx.refuse('value-not-allowed', valueParser.stringify(nodes).slice(0, 40));
    }
  };

const fontFamily: Special = (nodes, ctx) => {
  const names: string[] = [''];
  for (const node of meaningful(nodes)) {
    if (node.type === 'div' && node.value === ',') names.push('');
    else if (node.type === 'word' || (node.type === 'string' && node.unclosed !== true)) {
      names[names.length - 1] = `${names[names.length - 1] ?? ''} ${node.value}`
        .trim()
        .toLowerCase();
    } else {
      ctx.refuse('value-not-allowed', node.type);
      return;
    }
  }
  for (const name of names) {
    if (!FONT_FAMILY_NAMES.has(name)) ctx.refuse('value-not-allowed', name.slice(0, 40));
  }
};

const content: Special = (nodes, ctx) => {
  const parts = meaningful(nodes);
  const only = parts[0];
  const ok =
    parts.length === 1 &&
    only !== undefined &&
    ((only.type === 'word' && only.value.toLowerCase() === 'none') ||
      (only.type === 'string' && only.value === '' && only.unclosed !== true));
  if (!ok) ctx.refuse('value-not-allowed', 'content');
};

// A control a tenant can make invisible is as good as removed, so opacity
// has a floor.
const opacity: Special = (nodes, ctx) => {
  const parts = meaningful(nodes);
  const only = parts[0];
  const n =
    only?.type === 'word' && /^(?:\d+\.?\d*|\.\d+)$/.test(only.value) ? Number(only.value) : NaN;
  if (parts.length !== 1 || !(n >= 0.3 && n <= 1)) ctx.refuse('value-not-allowed', 'opacity');
};

const generic: Special = (nodes, ctx) => {
  checkNodes(nodes, ctx, 0, false);
};

const SPECIAL: Readonly<Record<string, Special>> = {
  display: oneOf(DISPLAY),
  position: oneOf(POSITION),
  overflow: oneOf(OVERFLOW),
  cursor: oneOf(CURSOR),
  'font-family': fontFamily,
  content,
  opacity,
};

const SIDES = [
  'top',
  'right',
  'bottom',
  'left',
  'inline',
  'block',
  'inline-start',
  'inline-end',
  'block-start',
  'block-end',
];
const CORNERS = [
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
  'start-start',
  'start-end',
  'end-start',
  'end-end',
];

function buildProperties(): ReadonlySet<string> {
  const names = [
    'color background-color border-color border-width border-style border-radius outline',
    'outline-color outline-width outline-style outline-offset width min-width max-width height',
    'min-height max-height inline-size block-size min-inline-size max-inline-size',
    'min-block-size max-block-size gap row-gap column-gap display flex flex-grow flex-shrink',
    'flex-basis flex-direction flex-wrap flex-flow grid-template-columns grid-template-rows',
    'align-items align-content align-self justify-content justify-items justify-self position',
    'overflow opacity box-shadow text-align text-transform text-decoration text-decoration-color',
    'text-decoration-line text-decoration-style text-decoration-thickness text-underline-offset',
    'letter-spacing line-height font-size font-weight font-style font-family white-space',
    'word-break list-style list-style-type list-style-position background background-image',
    'background-size background-position background-repeat object-fit cursor content',
  ].join(' ');
  const all = new Set(names.split(' '));
  for (const base of ['margin', 'padding', 'border']) {
    all.add(base);
    for (const side of SIDES) {
      all.add(`${base}-${side}`);
      if (base === 'border') {
        for (const part of ['width', 'style', 'color']) all.add(`border-${side}-${part}`);
      }
    }
  }
  for (const corner of CORNERS) all.add(`border-${corner}-radius`);
  return all;
}

const PROPERTIES = buildProperties();

function mediaAllowed(params: string): boolean {
  const feature =
    '\\((?:prefers-color-scheme: ?(?:light|dark)|(?:min|max)-width: ?\\d+(?:\\.\\d+)?(?:px|em|rem)|prefers-reduced-motion: ?(?:reduce|no-preference))\\)';
  return new RegExp(`^${feature}(?: and ${feature})*$`).test(params.toLowerCase());
}

// Fail closed: a stylesheet is accepted only when the parser can read all of
// it and every at-rule, selector, property and value in it is recognised.
// The tree is walked one level at a time, never recursively, so nesting
// cannot cost more than the size cap allows.
export function checkStylesheet(css: string, options: StylesheetOptions = {}): StylesheetIssue[] {
  const issues: StylesheetIssue[] = [];
  let stopped = false;
  const add: Add = (code, detail, node) => {
    if (stopped) return;
    if (issues.length >= MAX_ISSUES - 1) {
      issues.push({
        code: 'too-many-issues',
        detail: `more than ${String(MAX_ISSUES - 1)}`,
        line: null,
        column: null,
      });
      stopped = true;
      return;
    }
    const start = node?.source?.start;
    issues.push({ code, detail, line: start?.line ?? null, column: start?.column ?? null });
  };

  if (css.length > MAX_STYLESHEET_BYTES) {
    add('too-large', `${String(css.length)}+ bytes`);
    return issues;
  }
  if (css.length * 3 > MAX_STYLESHEET_BYTES) {
    const bytes = new TextEncoder().encode(css).length;
    if (bytes > MAX_STYLESHEET_BYTES) {
      add('too-large', `${String(bytes)} bytes`);
      return issues;
    }
  }
  const nul = css.indexOf('\u0000');
  if (nul !== -1) {
    const before = css.slice(0, nul);
    const line = before.split('\n').length;
    const column = nul - (before.lastIndexOf('\n') + 1) + 1;
    issues.push({ code: 'nul-byte', detail: 'NUL byte', line, column });
    return issues;
  }

  let root;
  try {
    root = parse(css);
  } catch (error) {
    const at = error as { reason?: unknown; line?: unknown; column?: unknown };
    issues.push({
      code: 'unparsable',
      detail: typeof at.reason === 'string' ? at.reason : 'unreadable',
      line: typeof at.line === 'number' ? at.line : null,
      column: typeof at.column === 'number' ? at.column : null,
    });
    return issues;
  }

  let rules = 0;
  let declarations = 0;

  const checkDeclaration = (decl: Declaration, mayHide: boolean): void => {
    declarations += 1;
    if (declarations > MAX_DECLARATIONS) {
      add('too-many-declarations', `more than ${String(MAX_DECLARATIONS)}`);
      stopped = true;
      return;
    }
    const property = decl.prop.toLowerCase();
    if (/\S/.test(decl.raws.before ?? '') || !PROPERTIES.has(property)) {
      add('property-not-allowed', decl.prop.slice(0, 60), decl);
      return;
    }
    // Refused everywhere rather than on layout properties only: nothing a
    // tenant needs depends on beating the server's own rules.
    if (decl.important) {
      add('value-not-allowed', '!important', decl);
      return;
    }
    if (decl.value.length > MAX_VALUE_LENGTH) {
      add('too-long', `${property} value longer than ${String(MAX_VALUE_LENGTH)} characters`, decl);
      return;
    }
    if (property === 'display' && decl.value.trim().toLowerCase() === 'none' && !mayHide) {
      add('value-not-allowed', 'display: none could hide the form', decl);
      return;
    }
    const ctx: ValueContext = {
      property,
      isAssetUrl: options.isAssetUrl,
      refuse: (code, detail) => {
        add(code, `${property}: ${detail}`, decl);
      },
    };
    if (decl.value.trim() === '') ctx.refuse('value-not-allowed', 'empty');
    else (SPECIAL[property] ?? generic)(valueParser(decl.value).nodes, ctx);
  };

  const checkRule = (rule: Rule): void => {
    rules += 1;
    if (rules > MAX_RULES) {
      add('too-many-rules', `more than ${String(MAX_RULES)}`);
      stopped = true;
      return;
    }
    const compounds: Compound[][] = [];
    const selector = rule.selector;
    if (selector.length > MAX_SELECTOR_LENGTH) {
      add('too-long', `selector longer than ${String(MAX_SELECTOR_LENGTH)} characters`, rule);
    } else {
      const list = selector.split(',');
      if (list.length > MAX_SELECTORS) {
        add('too-long', `more than ${String(MAX_SELECTORS)} selectors`, rule);
      } else {
        for (const one of list) {
          const read = readSelector(one);
          if ('code' in read) add(read.code, read.detail, rule);
          else compounds.push(read);
        }
      }
    }
    const mayHide = compounds.length > 0 && mayBeHidden(compounds);
    for (const child of rule.nodes) {
      if (stopped) return;
      if (child.type === 'decl') checkDeclaration(child, mayHide);
      else if (child.type === 'rule') add('selector-not-allowed', 'a nested rule', child);
      else if (child.type === 'atrule') {
        add('at-rule-not-allowed', `@${child.name} inside a rule`, child);
      }
    }
  };

  const checkAtRule = (rule: AtRule): void => {
    if (rule.name !== 'media') {
      add('at-rule-not-allowed', `@${rule.name}`.slice(0, 60), rule);
    } else if (rule.nodes === undefined) {
      add('at-rule-not-allowed', '@media without a block', rule);
    } else if (
      rule.params.length > MAX_PARAMS_LENGTH ||
      rule.raws.params !== undefined ||
      !mediaAllowed(rule.params)
    ) {
      add('media-query-not-allowed', rule.params.slice(0, 60), rule);
    } else {
      for (const child of rule.nodes) visit(child, true);
    }
  };

  const visit = (node: ChildNode, inMedia: boolean): void => {
    if (stopped) return;
    if (node.type === 'decl') add('root-declaration', node.prop.slice(0, 60), node);
    else if (node.type === 'rule') checkRule(node);
    else if (node.type === 'atrule') {
      if (inMedia) add('at-rule-not-allowed', `@${node.name} inside @media`, node);
      else checkAtRule(node);
    }
  };

  for (const node of root.nodes) visit(node, false);
  return issues;
}
