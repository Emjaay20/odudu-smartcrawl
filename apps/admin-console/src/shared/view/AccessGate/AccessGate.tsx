import type { ReactNode } from 'react';
import type { Crumb } from '#/shared/view/Breadcrumb';
import { CapabilityNote } from '#/shared/view/CapabilityNote';
import { PageHeader } from '#/shared/view/PageHeader';
import { PageNotFound } from '#/shared/view/PageNotFound';
import { Skeleton } from '#/shared/view/Skeleton';

// What whoami says of a principal's reach into an area.
export type Access =
  { kind: 'hidden' | 'checking' | 'open' } | { kind: 'refused'; capability: string };

// whoami is advice: a principal it says cannot read the area is told what
// that needs, rather than offered reads the server would refuse, and an area
// it does not name is simply not a page.
export function AccessGate({
  access,
  title,
  kicker,
  breadcrumb,
  checking,
  children,
}: {
  access: Access;
  title: string;
  kicker: string;
  // A page below the list keeps its way back while it is refused.
  breadcrumb?: readonly Crumb[];
  // What the placeholder says until whoami has answered. With none, the page
  // is drawn meanwhile.
  checking?: string;
  children: ReactNode;
}) {
  const head = (
    <PageHeader {...(breadcrumb === undefined ? { kicker } : { breadcrumb })} title={title} />
  );
  switch (access.kind) {
    case 'hidden':
      return <PageNotFound />;
    case 'refused':
      return (
        <>
          {head}
          <CapabilityNote capability={access.capability}>{title}</CapabilityNote>
        </>
      );
    case 'checking':
      if (checking === undefined) return children;
      return (
        <>
          {head}
          <Skeleton label={checking} />
        </>
      );
    case 'open':
      return children;
  }
}
