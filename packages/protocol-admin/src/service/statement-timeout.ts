const QUERY_CANCELED = '57014';

// Postgres cancels a statement that outlives `statement_timeout` with this
// SQLSTATE; the driver, and the query builder over it, each wrap the error.
export function isStatementTimeout(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && typeof current === 'object' && current !== null; depth += 1) {
    if ('code' in current && current.code === QUERY_CANCELED) return true;
    current = 'cause' in current ? current.cause : undefined;
  }
  return false;
}
