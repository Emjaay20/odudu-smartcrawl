import type { ReactNode } from 'react';
import { useTenantsArea } from '#/features/tenants/usecase/useTenantsArea';
import { AccessGate } from '#/shared/view/AccessGate';
import type { Crumb } from '#/shared/view/Breadcrumb';

// The page is drawn, and its reads made, only once whoami says the System
// area is this principal's.
export function SystemGate({
  tenant,
  title,
  breadcrumb,
  children,
}: {
  tenant: string;
  title: string;
  breadcrumb?: readonly Crumb[];
  children: ReactNode;
}) {
  const access = useTenantsArea(tenant);
  return (
    <AccessGate
      access={access}
      title={title}
      kicker="System"
      {...(breadcrumb === undefined ? {} : { breadcrumb })}
      checking={`Checking access to ${title}`}
    >
      {children}
    </AccessGate>
  );
}
