import type { ReactNode } from 'react';
import { checkingText, type Area } from '#/features/shell/service';
import { useArea } from '#/features/shell/usecase/useArea';
import { AccessGate } from '#/shared/view/AccessGate';
import type { Crumb } from '#/shared/view/Breadcrumb';

// The page is not drawn, so makes none of its reads, until whoami has answered.
export function AreaGate({
  tenant,
  area,
  title,
  breadcrumb,
  children,
}: {
  tenant: string;
  area: Area;
  title: string;
  breadcrumb?: readonly Crumb[];
  children: ReactNode;
}) {
  return (
    <AccessGate
      access={useArea(tenant, area)}
      title={title}
      kicker={tenant}
      {...(breadcrumb === undefined ? {} : { breadcrumb })}
      checking={checkingText(area)}
    >
      {children}
    </AccessGate>
  );
}
