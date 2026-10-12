import type { Crumb } from '#/shared/service/breadcrumb';

export function scopesHref(tenant: string): string {
  return `/console/${encodeURIComponent(tenant)}/scopes`;
}

export function newScopeHref(tenant: string): string {
  return `${scopesHref(tenant)}/new`;
}

export function scopeHref(tenant: string, id: string): string {
  return `${scopesHref(tenant)}/${encodeURIComponent(id)}`;
}

// The rail group is a heading, not a page, so it has no address.
export function scopesTrail(tenant: string, current: string): readonly Crumb[] {
  return [
    { label: 'Applications' },
    { label: 'Scopes', href: scopesHref(tenant) },
    { label: current },
  ];
}
