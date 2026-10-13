import type { ClientScope } from '@odudu/contracts/admin';
import { useId, useRef } from 'react';
import {
  useScopeClientsTab,
  type ScopeClientsTab,
} from '#/features/scopes/usecase/useScopeClientsTab';
import { Button } from '#/shared/view/Button';
import { CapabilityNote } from '#/shared/view/CapabilityNote';
import { ClientPicker } from '#/shared/view/ClientPicker';
import { EmptyState } from '#/shared/view/EmptyState';
import { InlineFields, SelectField } from '#/shared/view/Field';
import { ListSkeleton } from '#/shared/view/Skeleton';
import styles from '#/features/scopes/view/ScopeRecordPage/Tab.module.css';
import { ASSIGNMENTS, ASSIGNMENT_RULE } from '#/shared/service/assignment';

function Carriers({ scope, page }: { scope: ClientScope; page: ScopeClientsTab }) {
  const heading = useId();
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
    body = (
      <EmptyState
        variant="failed"
        title="The clients could not be loaded"
        action={<Button onPress={list.retry}>Try again</Button>}
      >
        The gateway did not answer, or answered with an error.
      </EmptyState>
    );
  } else if (list.rows.length === 0) {
    body = <p className={styles.text}>{`No client carries ${scope.name}.`}</p>;
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
    <section aria-labelledby={heading} className={styles.panel}>
      <h2 id={heading} ref={title} tabIndex={-1} className={styles.heading}>
        {label}
      </h2>
      <p className={styles.rule}>{`${ASSIGNMENT_RULE} ${page.count}`}</p>
      {body}
      {list.more ? (
        <div className={styles.actions}>
          <Button isDisabled={list.loadingMore} onPress={list.loadMore}>
            {list.loadingMore ? 'Loading more clients…' : 'Load more clients'}
          </Button>
        </div>
      ) : null}
      {list.loadMoreFailed ? (
        <p role="alert" className={styles.message}>
          More clients could not be loaded. The ones above are still shown.
        </p>
      ) : null}
      {page.message === null ? null : (
        <p role="alert" className={styles.message}>
          {page.message}
        </p>
      )}
    </section>
  );
}

function Assign({ page }: { page: ScopeClientsTab }) {
  const heading = useId();
  return (
    <section aria-labelledby={heading} className={styles.panel}>
      <h2 id={heading} className={styles.heading}>
        Assign to a client
      </h2>
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
      <div className={styles.actions}>
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
    </section>
  );
}

export function ClientsTab({ tenant, scope }: { tenant: string; scope: ClientScope }) {
  const page = useScopeClientsTab({ tenant, scope });
  return (
    <div className={styles.tab}>
      <Carriers scope={scope} page={page} />
      {page.offered ? <Assign page={page} /> : null}
      {page.needs.length > 0 ? (
        <CapabilityNote capability="manage-clients">Choosing a client to assign</CapabilityNote>
      ) : null}
    </div>
  );
}
