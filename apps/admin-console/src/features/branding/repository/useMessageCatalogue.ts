import type { MessageCatalogueResponse } from '@odudu/contracts/admin';
import { readMessageCatalogue } from '#/features/branding/adapter/overrides';
import { messageCatalogueKey } from '#/shared/repository/queryKeys';
import { useRead } from '#/shared/repository/useRead';
import type { Read } from '#/shared/service/read';
import { useTransport } from '#/shared/transport/useTransport';

export function useMessageCatalogue(tenant: string): Read<MessageCatalogueResponse> {
  const { gateway } = useTransport();
  return useRead(messageCatalogueKey(tenant), true, () => readMessageCatalogue(gateway, tenant));
}
