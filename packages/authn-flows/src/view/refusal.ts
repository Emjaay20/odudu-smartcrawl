import { type PageLocale } from '@odudu/kernel';
import { type EnrolmentRefusal } from '#/schema/enrolment-refusal';
import { tHtml, type MessageId } from '#/view/messages';

const REFUSAL_MESSAGE: Readonly<Record<EnrolmentRefusal, MessageId>> = {
  code_mismatch: 'refusal.codeMismatch',
  codes_not_saved: 'refusal.codesNotSaved',
  passkey_not_added: 'refusal.passkeyNotAdded',
};

// The line above the form that says why it is back, or nothing on a first visit.
export function refusalHtml(locale: PageLocale, refusal: EnrolmentRefusal | undefined): string {
  return refusal === undefined
    ? ''
    : `<p><strong>${tHtml(locale, REFUSAL_MESSAGE[refusal])}</strong></p>\n`;
}
