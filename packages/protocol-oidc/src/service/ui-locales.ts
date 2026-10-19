// RFC 5646 §4.4.1 recommends supporting tags of at least 35 characters and
// no tag outside this alphabet exists.
const TAG = /^[A-Za-z0-9-]{1,35}$/u;

// A preference list longer than any browser sends is padding, and the
// negotiation reads it linearly on every page of the sign-in.
export const MAX_UI_LOCALES = 16;

// OIDC Core §3.1.2.1: `ui_locales` is a space-separated list of BCP47 tags,
// most preferred first. What is parked is only what could be a tag; whether
// one is a language the server speaks is the negotiation's question, and
// nothing parked here reaches a page except through its answer.
export function parseUiLocales(raw: string | undefined): string[] {
  if (raw === undefined) return [];
  const tags: string[] = [];
  for (const candidate of raw.split(' ')) {
    if (tags.length === MAX_UI_LOCALES) break;
    if (TAG.test(candidate) && !tags.includes(candidate)) tags.push(candidate);
  }
  return tags;
}
