import { readAssetImage } from '#/features/branding/adapter/theme';
import { slotThumbnail, type ImageSlot, type Thumbnail } from '#/features/branding/service';
import { assetImageKey } from '#/shared/repository/queryKeys';
import { useRead } from '#/shared/repository/useRead';
import { useTransport } from '#/shared/transport/useTransport';

function useThumbnail(tenant: string, assetId: string | null): Thumbnail {
  const { gateway } = useTransport();
  const id = assetId ?? '';
  const read = useRead(assetImageKey(tenant, id), assetId !== null, () =>
    readAssetImage(gateway, tenant, id),
  );
  return slotThumbnail(assetId, read);
}

// The image each slot holds, read from the server, so that an upload shows
// before any theme publishes it and a reload shows what was saved.
export function useSlotImages(
  tenant: string,
  ids: Record<ImageSlot, string | null>,
): Record<ImageSlot, Thumbnail> {
  return {
    logo: useThumbnail(tenant, ids.logo),
    darkLogo: useThumbnail(tenant, ids.darkLogo),
    favicon: useThumbnail(tenant, ids.favicon),
    background: useThumbnail(tenant, ids.background),
  };
}
