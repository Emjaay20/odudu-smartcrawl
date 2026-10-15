import { useQueryClient } from '@tanstack/react-query';

export function seed(): void {
  useQueryClient().setQueryData(['list', 'acme', 'roles'], []);
  useQueryClient().invalidateQueries({ queryKey: ['record', 'acme', 'x'] });
}
