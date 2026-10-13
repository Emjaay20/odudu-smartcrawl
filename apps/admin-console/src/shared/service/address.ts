import type { Crumb } from '#/shared/service/breadcrumb';
import { stringifySearch } from '#/shared/service/search';

export function tenantPage(tenant: string): string {
  return `/console/${encodeURIComponent(tenant)}`;
}

// A page's address with its query parameters; a parameter left undefined is left out.
export function withSearch(href: string, search: Record<string, string | undefined>): string {
  return `${href}${stringifySearch(search)}`;
}

interface ResourceNames {
  // The path segment under the tenant: "clients".
  segment: string;
  // The rail group the list sits under, which is a heading and has no address.
  group: string;
  // The list's own name in a breadcrumb: "Clients".
  label: string;
}

export interface ResourceAddress {
  listHref: (tenant: string) => string;
  newHref: (tenant: string) => string;
  recordHref: (tenant: string, id: string) => string;
  trail: (tenant: string, current: string) => readonly Crumb[];
}

// The addresses of a resource's list, its creation page and its records,
// each tenant and id encoded, and the breadcrumb to a record.
export function resourceAddress({ segment, group, label }: ResourceNames): ResourceAddress {
  const listHref = (tenant: string): string => `${tenantPage(tenant)}/${segment}`;
  return {
    listHref,
    newHref: (tenant) => `${listHref(tenant)}/new`,
    recordHref: (tenant, id) => `${listHref(tenant)}/${encodeURIComponent(id)}`,
    trail: (tenant, current) => [
      { label: group },
      { label, href: listHref(tenant) },
      { label: current },
    ],
  };
}
