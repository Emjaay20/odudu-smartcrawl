import { useQueryClient, type QueryKey } from '@tanstack/react-query';

// A failed refetch is the next read's to show, so an invalidation never
// rejects into its caller.
export function useInvalidate() {
  const client = useQueryClient();
  return {
    // Every query under each key's prefix is read again.
    invalidate: (...keys: readonly QueryKey[]): void => {
      for (const queryKey of keys) {
        client.invalidateQueries({ queryKey }).catch(() => undefined);
      }
    },
    // Only the query at exactly this key.
    invalidateExact: (queryKey: QueryKey): void => {
      client.invalidateQueries({ queryKey, exact: true }).catch(() => undefined);
    },
  };
}
