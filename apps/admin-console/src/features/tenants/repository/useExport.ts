import { TENANT_DOCUMENT_MEDIA_TYPE } from '@odudu/contracts/admin';
import { saveFile } from '#/features/tenants/adapter/files';
import { readExport } from '#/features/tenants/adapter/tenants';
import { exportedOf, exportFileName, type Exported } from '#/features/tenants/service';
import { useFreshRead } from '#/shared/repository/useFreshRead';
import type { GatewayResult } from '#/shared/transport/gateway';
import { useTransport } from '#/shared/transport/useTransport';

export interface TenantExport {
  busy: boolean;
  start: (includeSubjects: boolean) => Promise<GatewayResult<Exported>>;
}

function currentTime(): Date {
  return new Date();
}

// The document is saved as the text the server sent and kept nowhere else:
// what stays behind is its name, its size and what it says it left out.
export function useExport(tenant: string, now: () => Date = currentTime): TenantExport {
  const { gateway } = useTransport();
  const fresh = useFreshRead();
  const start = async (includeSubjects: boolean): Promise<GatewayResult<Exported>> => {
    const result = await fresh.read(['export', tenant, includeSubjects], () =>
      readExport(gateway, tenant, includeSubjects),
    );
    if (!result.ok) return result;
    const { text, contentType } = result.data;
    const fileName = exportFileName(tenant, now());
    saveFile(fileName, text, contentType ?? TENANT_DOCUMENT_MEDIA_TYPE);
    return { ...result, data: exportedOf(fileName, text) };
  };
  return { busy: fresh.pending, start };
}
