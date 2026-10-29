import { useQuery } from '@tanstack/react-query';
import { useInvalidate } from '#/shared/repository/useInvalidate';
import { freshness, readOutcome, type Read } from '#/shared/service/read';
import type { GatewayResult } from '#/shared/transport/gateway';

// One read a tab shows, keyed so a change elsewhere can ask for it again.
// An `immutable` read is of something that never changes under its key, so it
// is not asked for again when the window regains focus.
export function useRead<T>(
  key: readonly unknown[],
  asked: boolean,
  read: () => Promise<GatewayResult<T>>,
  { immutable = false }: { immutable?: boolean } = {},
): Read<T> {
  const { invalidateExact } = useInvalidate();
  const query = useQuery({
    queryKey: key,
    queryFn: read,
    enabled: asked,
    ...freshness(immutable),
  });
  return readOutcome(query.data, () => {
    invalidateExact(key);
  });
}
