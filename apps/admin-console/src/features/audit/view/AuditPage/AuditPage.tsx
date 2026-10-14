import { AreaGate, areaAt } from '#/features/shell';
import {
  EXPORT_NOTE,
  NO_COUNT,
  NOTHING_MATCHES,
  NOTHING_YET,
  STALE_TEXT,
  STALE_TITLE,
  TITLE,
} from '#/features/audit/service';
import { useAuditPage, type AuditPageState } from '#/features/audit/usecase/useAuditPage';
import { AuditFilters } from '#/features/audit/view/AuditFilters';
import { CORRELATION_NOTE } from '#/shared/service/auditEvents';
import { auditColumns, AuditTable } from '#/shared/view/AuditTable';
import { Button } from '#/shared/view/Button';
import { EmptyState } from '#/shared/view/EmptyState';
import { ListGate } from '#/shared/view/ListGate';
import { LoadMoreFailed } from '#/shared/view/LoadMore';
import { LiveMessage } from '#/shared/view/Message';
import { Note } from '#/shared/view/Note';
import { PageHeader } from '#/shared/view/PageHeader';
import { Pager } from '#/shared/view/Pager';
import { TableSkeleton } from '#/shared/view/Skeleton';
import styles from '#/features/audit/view/AuditPage/AuditPage.module.css';

function Rows({ page }: { page: AuditPageState }) {
  const { list, hrefs, narrowed } = page;
  if (list.rows.length === 0 && narrowed) {
    return (
      <EmptyState
        variant="nothing-matches"
        title="No event matches these filters"
        action={<Button onPress={page.form.clear}>Show every event</Button>}
      >
        {NOTHING_MATCHES}
      </EmptyState>
    );
  }
  if (list.rows.length === 0) {
    return (
      <EmptyState variant="nothing-yet" title="No audit events yet">
        {NOTHING_YET}
      </EmptyState>
    );
  }
  return (
    <>
      <AuditTable label="Audit events" rows={list.rows} withResource hrefs={hrefs} />
      <Pager label="Audit events" list={list} />
      {list.loadMoreFailed ? <LoadMoreFailed noun="audit events" /> : null}
    </>
  );
}

function Body({ page }: { page: AuditPageState }) {
  const { list } = page;
  if (list.staleCursor) {
    return (
      <EmptyState
        variant="failed"
        title={STALE_TITLE}
        action={<Button onPress={list.startAgain}>Start again</Button>}
      >
        {STALE_TEXT}
      </EmptyState>
    );
  }
  return (
    <ListGate
      list={list}
      loading={
        <TableSkeleton
          label="Loading audit events"
          columns={auditColumns({ withResource: true })}
        />
      }
      refused={{ capability: 'view-audit', noun: TITLE }}
      failed="The audit trail could not be loaded"
      unchanged
    >
      {() => <Rows page={page} />}
    </ListGate>
  );
}

function Trail({ tenant }: { tenant: string }) {
  const page = useAuditPage(tenant);
  const refused = page.list.status === 'refused';
  return (
    <>
      <PageHeader
        title={TITLE}
        kicker={tenant}
        description="Every change made in this tenant, and every one refused, with who made it and from where."
        {...(refused
          ? {}
          : {
              actions: (
                <Button isDisabled={page.exporting.busy} onPress={page.exporting.start}>
                  {page.exporting.busy ? 'Exporting…' : 'Export these events'}
                </Button>
              ),
            })}
      />
      <div className={styles.page}>
        {refused ? null : <AuditFilters form={page.form} />}
        {page.list.ignored.map((text) => (
          <Note key={text}>{text}</Note>
        ))}
        <div className={styles.meta}>
          <p>
            {NO_COUNT}
            {page.range === null ? null : ` ${page.range}`}
          </p>
          <p>{CORRELATION_NOTE}</p>
          <p>{EXPORT_NOTE}</p>
        </div>
        <LiveMessage label="Last export">{page.exporting.message}</LiveMessage>
        <Body page={page} />
      </div>
    </>
  );
}

export function AuditPage({ tenant }: { tenant: string }) {
  return (
    <AreaGate tenant={tenant} area={areaAt('audit')} title={TITLE}>
      <Trail tenant={tenant} />
    </AreaGate>
  );
}
