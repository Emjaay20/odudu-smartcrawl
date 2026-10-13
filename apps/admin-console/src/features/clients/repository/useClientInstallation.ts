import type { ClientInstallation } from '@odudu/contracts/admin';
import { readInstallation } from '#/features/clients/adapter/operations';
import { useRead } from '#/shared/repository/useRead';
import type { Read } from '#/shared/service/read';
import { useTransport } from '#/shared/transport/useTransport';

export function useClientInstallation(
  tenant: string,
  clientDbId: string,
): Read<ClientInstallation> {
  const { gateway } = useTransport();
  return useRead(['installation', tenant, clientDbId], true, () =>
    readInstallation(gateway, tenant, clientDbId),
  );
}
