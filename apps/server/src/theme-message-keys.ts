import {
  ACCOUNT_PAGE_MESSAGES,
  DEFAULT_TEMPLATES as ACCOUNT_KINDS,
  isAccountMessageKey,
} from '@odudu/account';
import {
  AUTHN_PAGE_MESSAGES,
  DEFAULT_TEMPLATES as AUTHN_KINDS,
  isAuthnMessageKey,
} from '@odudu/authn-flows';
import { type MessageCatalogueResponse } from '@odudu/contracts/admin';
import { type PageKind } from '@odudu/kernel';
import {
  DEFAULT_TEMPLATES as OIDC_KINDS,
  isOidcMessageKey,
  OIDC_PAGE_MESSAGES,
} from '@odudu/protocol-oidc';

const OWNERS: readonly {
  kinds: Readonly<Record<string, string>>;
  has: (key: string) => boolean;
  messages: Readonly<Record<string, string>>;
}[] = [
  { kinds: OIDC_KINDS, has: isOidcMessageKey, messages: OIDC_PAGE_MESSAGES },
  { kinds: ACCOUNT_KINDS, has: isAccountMessageKey, messages: ACCOUNT_PAGE_MESSAGES },
  { kinds: AUTHN_KINDS, has: isAuthnMessageKey, messages: AUTHN_PAGE_MESSAGES },
];

// Whether `{{t "key"}}` in a template of `kind` names an entry of the
// catalogue the page is filled from. Each page kind is filled by one package,
// whose catalogue alone holds its keys; a kind none of them fills has none.
export function isThemeMessageKey(kind: PageKind, key: string): boolean {
  return OWNERS.some((owner) => Object.hasOwn(owner.kinds, kind) && owner.has(key));
}

export function pageKindOwners(kind: PageKind): number {
  return OWNERS.filter((owner) => Object.hasOwn(owner.kinds, kind)).length;
}

// Whether a key is an entry of the English catalogue of any page, which is
// what a tenant's message override may name.
export function isOverridableMessageKey(key: string): boolean {
  return OWNERS.some((owner) => owner.has(key));
}

// What the three catalogues hold, by the page kinds each fills: the keys a
// template may name and an override may be set under, with their English
// text. Static for a build, so the answer is built once.
function buildCatalogue(): MessageCatalogueResponse {
  return {
    sections: OWNERS.map((owner) => ({
      kinds: Object.keys(owner.kinds) as PageKind[],
      messages: Object.keys(owner.messages)
        .sort()
        .map((key) => ({ key, en: owner.messages[key] ?? '' })),
    })),
  };
}

const CATALOGUE = buildCatalogue();

export function pageMessageCatalogue(): MessageCatalogueResponse {
  return CATALOGUE;
}
