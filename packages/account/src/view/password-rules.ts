import { MAX_PASSWORD_LENGTH, type PageLocale } from '@odudu/kernel';
import { bdi, tHtml, type MessageId } from '#/view/messages';

// A rule a candidate password broke: `rule` is the code a catalogue entry is
// looked up by, `message` the developer-facing sentence for a rule this build
// has no entry for, `minLength` the number the minimum-length sentence states.
export interface PasswordViolation {
  rule: string;
  message: string;
  minLength?: number;
}

const RULE_MESSAGE: Readonly<Record<string, MessageId>> = {
  'min-length': 'password.rule.minLength',
  'max-length': 'password.rule.maxLength',
  'require-digit': 'password.rule.requireDigit',
  'require-uppercase': 'password.rule.requireUppercase',
  'require-lowercase': 'password.rule.requireLowercase',
  'require-special': 'password.rule.requireSpecial',
  'not-username': 'password.rule.notUsername',
  'not-email': 'password.rule.notEmail',
  'not-reused': 'password.rule.notReused',
};

// The domain's sentences are developer-facing English, so a rule this build
// has no entry for shows that sentence, isolated, rather than nothing.
export function ruleHtml(violation: PasswordViolation, locale: PageLocale): string {
  const id = Object.hasOwn(RULE_MESSAGE, violation.rule) ? RULE_MESSAGE[violation.rule] : undefined;
  // A minimum the page was not told is not one to state.
  if (id === undefined || (violation.rule === 'min-length' && violation.minLength === undefined)) {
    return bdi(violation.message);
  }
  return tHtml(locale, id, { min: violation.minLength ?? 0, max: MAX_PASSWORD_LENGTH });
}

export function ruleListHtml(violations: readonly PasswordViolation[], locale: PageLocale): string {
  const items = violations.map((violation) => `<li>${ruleHtml(violation, locale)}</li>`);
  return `<ul>\n${items.join('\n')}\n</ul>`;
}
