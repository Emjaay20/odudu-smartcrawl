// The authority for `dir`: browsers do not all expose Intl.Locale getTextInfo,
// so direction.test.ts holds this table to the platform instead.
const RTL_LANGUAGES: ReadonlySet<string> = new Set([
  'ar',
  'arc',
  'ckb',
  'dv',
  'fa',
  'he',
  'ks',
  'ps',
  'sd',
  'ug',
  'ur',
  'yi',
]);

const RTL_SCRIPTS: ReadonlySet<string> = new Set(['adlm', 'arab', 'hebr', 'nkoo', 'syrc', 'thaa']);

const SCRIPT = /^[a-z]{4}$/u;

export function directionOf(tag: string): 'ltr' | 'rtl' {
  const [language = '', second = ''] = tag.toLowerCase().split('-');
  if (SCRIPT.test(second)) return RTL_SCRIPTS.has(second) ? 'rtl' : 'ltr';
  return RTL_LANGUAGES.has(language) ? 'rtl' : 'ltr';
}
