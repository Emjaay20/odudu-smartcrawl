import type { QueryClient } from '@tanstack/react-query';

export function reach(client: QueryClient, key: readonly unknown[]): void {
  const { invalidateQueries } = client;
  invalidateQueries({ queryKey: key });
  client['invalidateQueries']({ queryKey: key });
}
