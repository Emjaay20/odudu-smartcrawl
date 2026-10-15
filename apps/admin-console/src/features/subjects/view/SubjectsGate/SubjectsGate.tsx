import type { ReactNode } from 'react';
import { useSubjectsArea } from '#/features/subjects/usecase/useSubjectsArea';
import { AccessGate } from '#/shared/view/AccessGate';
import type { Crumb } from '#/shared/view/Breadcrumb';

export function SubjectsGate({
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
  const access = useSubjectsArea(tenant);
  return (
    <AccessGate
      access={access}
      title={title}
      kicker={tenant}
      checking={null}
      {...(breadcrumb === undefined ? {} : { breadcrumb })}
    >
      {children}
    </AccessGate>
  );
}
