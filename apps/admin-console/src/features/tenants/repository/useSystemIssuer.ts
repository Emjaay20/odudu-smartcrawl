import { useQuery } from '@tanstack/react-query';
import { readSystemIssuer } from '#/features/tenants/adapter/tenants';
import { systemIssuerKey } from '#/shared/repository/queryKeys';
import { dataOf } from '#/shared/service/settled';
import { useTransport } from '#/shared/transport/useTransport';

// The system tenant's issuer as relying parties see it, the public base's.
export function useSystemIssuer(): string | undefined {
  const { gateway } = useTransport();
  const query = useQuery({
    queryKey: systemIssuerKey(),
    queryFn: () => readSystemIssuer(gateway),
    staleTime: Infinity,
  });
  return dataOf(query.data);
}
