import type { ClientScope } from '@odudu/contracts/admin';
import type { ReactNode } from 'react';
import { useAuditReadable } from '#/features/session';
import { AreaGate, areaAt } from '#/features/shell';
import {
  copyHrefOf,
  SCOPE_TAB_LABELS,
  SCOPE_TABS,
  scopesTrail,
  type ScopeTab,
} from '#/features/scopes/service';
import { useRecordActivity } from '#/shared/usecase/useRecordActivity';
import { useScopeRecordPage } from '#/features/scopes/usecase/useScopeRecordPage';
import { ClientsTab } from '#/features/scopes/view/ScopeRecordPage/ClientsTab';
import { GeneralTab } from '#/features/scopes/view/ScopeRecordPage/GeneralTab';
import { MappersTab } from '#/features/scopes/view/ScopeRecordPage/MappersTab';
import { RolesTab } from '#/features/scopes/view/ScopeRecordPage/RolesTab';
import { ActivityTab } from '#/shared/view/ActivityTab';
import { ButtonLink } from '#/shared/view/ButtonLink';
import { CapabilityNote } from '#/shared/view/CapabilityNote';
import { RecordPage } from '#/shared/view/RecordPage';
import styles from '#/features/scopes/view/ScopeRecordPage/Tab.module.css';

interface PanelProps {
  tenant: string;
  scope: ClientScope;
  etag: string;
  gone: boolean;
}

function Trail({ tenant, id }: { tenant: string; id: string }) {
  const list = useRecordActivity('scope', tenant, id);
  return <ActivityTab list={list} noun="scope" />;
}

function Activity({ tenant, id }: { tenant: string; id: string }) {
  const readable = useAuditReadable(tenant);
  return (
    <div className={styles.tab}>
      <p className={styles.rule}>
        Every change made to this scope, and every change refused. A client being given or losing it
        is filed under that client.
      </p>
      {readable ? (
        <Trail tenant={tenant} id={id} />
      ) : (
        <CapabilityNote capability="view-audit">Activity</CapabilityNote>
      )}
    </div>
  );
}

// One panel per tab, in SCOPE_TABS' order.
const PANELS: Readonly<Record<ScopeTab, (props: PanelProps) => ReactNode>> = {
  general: (props) => <GeneralTab {...props} />,
  roles: (props) => <RolesTab tenant={props.tenant} scope={props.scope} />,
  mappers: (props) => <MappersTab tenant={props.tenant} scope={props.scope} />,
  clients: (props) => <ClientsTab tenant={props.tenant} scope={props.scope} />,
  activity: (props) => <Activity tenant={props.tenant} id={props.scope.id} />,
};

function Record({ tenant, id }: { tenant: string; id: string }) {
  const page = useScopeRecordPage(tenant, id);
  const { scope, etag } = page;
  const title = scope?.name ?? 'Scope';
  const props: PanelProps | null =
    scope === undefined || etag === null ? null : { tenant, scope, etag, gone: page.record.gone };
  return (
    <RecordPage
      record={page.record}
      breadcrumb={scopesTrail(tenant, title)}
      title={title}
      {...(scope?.description == null ? {} : { description: scope.description })}
      {...(scope === undefined
        ? {}
        : {
            actions: (
              <ButtonLink href={copyHrefOf(tenant, scope.id)} size="small">
                Create a copy
              </ButtonLink>
            ),
          })}
      noun="scope"
      readOnly={false}
      label="Scope sections"
      tab={page.tab}
      onTabChange={page.selectTab}
      tabs={SCOPE_TABS.map((tab) => ({
        id: tab,
        label: SCOPE_TAB_LABELS[tab],
        dirty: page.dirty.has(tab),
        panel: props === null ? null : PANELS[tab](props),
      }))}
    />
  );
}

export function ScopeRecordPage({ tenant, id }: { tenant: string; id: string }) {
  return (
    <AreaGate
      tenant={tenant}
      area={areaAt('scopes')}
      title="Scope"
      breadcrumb={scopesTrail(tenant, 'Scope')}
    >
      <Record tenant={tenant} id={id} />
    </AreaGate>
  );
}
