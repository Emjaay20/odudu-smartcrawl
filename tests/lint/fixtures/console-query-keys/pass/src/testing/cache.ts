import type { QueryClient } from '@tanstack/react-query';

export function seeded(client: QueryClient): void {
  client.setQueryData(['list', 'acme', 'roles'], []);
}
