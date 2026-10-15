// Disabling a subject ends nothing it holds, so every door that accepts
// something it was issued asks this of its subject: `/userinfo`,
// `/introspect`, token exchange, refresh, redemption of an authorization
// code and the admin API alike. A subject that no longer exists is not an
// enabled one.
export function subjectIsEnabled(subject: { readonly disabledAt: Date | null } | null): boolean {
  return subject !== null && subject.disabledAt === null;
}
