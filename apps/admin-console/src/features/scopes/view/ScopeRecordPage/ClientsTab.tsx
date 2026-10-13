import type { ClientScope } from '@odudu/contracts/admin';
import { useRef } from 'react';
import {
  useScopeClientsTab,
  type ScopeClientsTab,
} from '#/features/scopes/usecase/useScopeClientsTab';
import { Button } from '#/shared/view/Button';
import { CapabilityNote } from '#/shared/view/CapabilityNote';
import { ClientPicker } from '#/shared/view/ClientPicker';
import { InlineFields, SelectField } from '#/shared/view/Field';
import { LoadFailed } from '#/shared/view/LoadFailed';
import { LoadMore } from '#/shared/view/LoadMore';
import { Panel } from '#/shared/view/Panel';
import { ListSkeleton } from '#/shared/view/Skeleton';
import { recordTab } from '#/shared/view/RecordTab';
import styles from '#/features/scopes/view/ScopeRecordPage/Tab.module.css';
import { ASSIGNMENTS, ASSIGNMENT_RULE } from '#/shared/service/assignment';

function Carriers({ scope, page }: { scope: ClientScope; page: ScopeClientsTab }) {
  const title = useRef<HTMLHeadingElement>(null);
  const { list } = page;
  const label = `Clients carrying ${scope.name}`;
  // A removed row takes the focus that was on it, so the heading holds it.
  const removed = async (row: Parameters<ScopeClientsTab['remove']>[0]): Promise<void> => {
    if (await page.remove(row)) title.current?.focus();
  };
  let body;
  if (list.status === 'loading') {
    body = <ListSkeleton label="Loading the clients" />;
  } else if (list.status === 'failed' || list.status === 'refused') {
    body = <LoadFailed title="The clients could not be loaded" retry={list.retry} />;
  } else if (list.rows.length === 0) {
    body = <p className={recordTab.text}>{`No client carries ${scope.name}.`}</p>;
  } else {
    body = (
      <ul aria-label={label} className={styles.clients}>
        {list.rows.map((row) => (
          <li key={row.id} className={styles.client}>
            <span>
              {row.name} <code>{row.client_id}</code>
            </span>
            <InlineFields>
              <SelectField
                label={`Assignment for ${row.name}`}
                hideLabel
                options={ASSIGNMENTS}
                value={row.assignment}
                isDisabled={page.working !== null}
                onChange={(value) => {
                  page.change(row, value).catch(() => undefined);
                }}
              />
            </InlineFields>
            <Button
              size="small"
              variant="quiet"
              isDisabled={page.working !== null}
              aria-label={`Unassign ${row.name}`}
              onPress={() => {
                removed(row).catch(() => undefined);
              }}
            >
              Unassign
            </Button>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <Panel title={label} headingRef={title}>
      <p className={recordTab.rule}>{`${ASSIGNMENT_RULE} ${page.count}`}</p>
      {body}
      {list.more ? (
        <div className={recordTab.actions}>
          <LoadMore noun="clients" loading={list.loadingMore} onPress={list.loadMore} />
        </div>
      ) : null}
      {list.loadMoreFailed ? (
        <p role="alert" className={recordTab.message}>
          More clients could not be loaded. The ones above are still shown.
        </p>
      ) : null}
      {page.message === null ? null : (
        <p role="alert" className={recordTab.message}>
          {page.message}
        </p>
      )}
    </Panel>
  );
}

function Assign({ page }: { page: ScopeClientsTab }) {
  return (
    <Panel title="Assign to a client">
      <ClientPicker
        label="Client to assign"
        picker={page.picker}
        selected={page.chosen === null ? [] : [page.chosen.id]}
        selectionMode="single"
        onChange={page.choose}
      />
      <SelectField
        label="Assign it as"
        options={ASSIGNMENTS}
        value={page.assignment}
        onChange={page.setAssignment}
      />
      <div className={recordTab.actions}>
        <Button
          variant="primary"
          isDisabled={page.chosen === null || page.working !== null}
          onPress={() => {
            page.assign().catch(() => undefined);
          }}
        >
          {page.chosen === null ? 'Assign to a client' : `Assign to ${page.chosen.name}`}
        </Button>
      </div>
    </Panel>
  );
}

export function ClientsTab({ tenant, scope }: { tenant: string; scope: ClientScope }) {
  const page = useScopeClientsTab({ tenant, scope });
  return (
    <div className={recordTab.tab}>
      <Carriers scope={scope} page={page} />
      {page.offered ? <Assign page={page} /> : null}
      {page.needs.length > 0 ? (
        <CapabilityNote capability="manage-clients">Choosing a client to assign</CapabilityNote>
      ) : null}
    </div>
  );
}
