import { useQuery } from '@tanstack/react-query';
import { useInvalidate } from '#/shared/repository/useInvalidate';
import { readOutcome, type Read } from '#/shared/service/read';
import type { GatewayResult } from '#/shared/transport/gateway';

// One read a tab shows, keyed so a change elsewhere can ask for it again.
export function useRead<T>(
  key: readonly unknown[],
  asked: boolean,
  read: () => Promise<GatewayResult<T>>,
): Read<T> {
  const { invalidateExact } = useInvalidate();
  const query = useQuery({ queryKey: key, queryFn: read, enabled: asked });
  return readOutcome(query.data, () => {
    invalidateExact(key);
  });
}
