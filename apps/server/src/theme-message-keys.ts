import { DEFAULT_TEMPLATES as ACCOUNT_KINDS, isAccountMessageKey } from '@odudu/account';
import { DEFAULT_TEMPLATES as AUTHN_KINDS, isAuthnMessageKey } from '@odudu/authn-flows';
import { type PageKind } from '@odudu/kernel';
import { DEFAULT_TEMPLATES as OIDC_KINDS, isOidcMessageKey } from '@odudu/protocol-oidc';

const OWNERS: readonly {
  kinds: Readonly<Record<string, string>>;
  has: (key: string) => boolean;
}[] = [
  { kinds: OIDC_KINDS, has: isOidcMessageKey },
  { kinds: ACCOUNT_KINDS, has: isAccountMessageKey },
  { kinds: AUTHN_KINDS, has: isAuthnMessageKey },
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
