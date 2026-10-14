import { useRead } from '#/shared/repository/useRead';

export function useReads(tenant: string) {
  return useRead(['record', tenant, 'x']);
}
