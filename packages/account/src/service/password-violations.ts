// A policy violation as the pages that list it read it: the minimum-length
// rule carries the number it states, which the evaluator's own report does not.
export function withMinimum<V extends { readonly rule: string }>(
  violations: readonly V[],
  minLength: number,
): (V & { minLength?: number })[] {
  return violations.map((violation) =>
    violation.rule === 'min-length' ? { ...violation, minLength } : violation,
  );
}
