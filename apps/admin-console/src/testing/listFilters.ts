import type { Sent } from '#/testing/fakeTransport';

// The list routes' `name` query: names are lowercase, and it matches a prefix.
export function matchesName(request: Sent, each: { name: string }): boolean {
  const name = request.search.get('name');
  return name === null || each.name.startsWith(name.toLowerCase());
}

// A list query that names a parent (a group's `parent`, a role's `client`):
// `top` asks for those with none, anything else for those under that id.
export function underParent(request: Sent, param: string, top: string, held: string | null) {
  const wanted = request.search.get(param);
  return wanted === null || (wanted === top ? held === null : held === wanted);
}
