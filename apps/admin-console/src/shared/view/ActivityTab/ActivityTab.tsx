import type { AuditEvent } from '@odudu/contracts/admin';
import type { ResourceListState } from '#/shared/service/resourceList';
import { AuditActor } from '#/shared/view/AuditActor';
import { CopyValue } from '#/shared/view/CopyValue';
import { DataTable, type Column } from '#/shared/view/DataTable';
import { EmptyState } from '#/shared/view/EmptyState';
import { ListGate } from '#/shared/view/ListGate';
import { LoadMoreFailed } from '#/shared/view/LoadMore';
import { Pager } from '#/shared/view/Pager';
import { TableSkeleton } from '#/shared/view/Skeleton';
import { StatusTag, type StatusTone } from '#/shared/view/StatusTag';
import { Timestamp } from '#/shared/view/Timestamp';
import styles from '#/shared/view/ActivityTab/ActivityTab.module.css';

export const OUTCOME_TONES: Record<AuditEvent['outcome'], StatusTone> = {
  allowed: 'active',
  refused: 'warning',
  failed: 'danger',
};

function columns(now: Date | undefined): readonly Column<AuditEvent>[] {
  return [
    {
      id: 'when',
      header: 'When',
      cell: (event) => (
        <Timestamp value={event.occurred_at} {...(now === undefined ? {} : { now })} />
      ),
      isRowHeader: true,
    },
    { id: 'action', header: 'Action', cell: (event) => <code>{event.action}</code> },
    {
      id: 'outcome',
      header: 'Outcome',
      cell: (event) => <StatusTag tone={OUTCOME_TONES[event.outcome]}>{event.outcome}</StatusTag>,
    },
    {
      id: 'actor',
      header: 'Actor',
      cell: (event) => <AuditActor event={event} />,
    },
    {
      id: 'correlation',
      header: 'Correlation id',
      cell: (event) =>
        event.request_id === null ? (
          <span className={styles.none}>none sent</span>
        ) : (
          <CopyValue label="correlation id" value={event.request_id} short />
        ),
    },
  ];
}

// The audit trail narrowed to one record: the same rows the Audit trail
// shows, never a second account of them.
export function ActivityTab({
  list,
  noun,
  now,
}: {
  list: ResourceListState<AuditEvent>;
  // What the record is: "client".
  noun: string;
  now?: Date;
}) {
  return (
    <ListGate
      list={list}
      loading={<TableSkeleton label="Loading activity" columns={columns(now)} />}
      refused={{ capability: 'view-audit', noun: 'Activity' }}
      failed="Activity could not be loaded"
    >
      {() =>
        list.rows.length === 0 ? (
          <EmptyState variant="nothing-yet" title={`No activity on this ${noun} yet`}>
            Every change made to it, and every change refused, is listed here.
          </EmptyState>
        ) : (
          <div className={styles.activity}>
            <p className={styles.note}>
              A correlation id links rows written for one request. The caller can set it, so it is a
              correlation, not evidence.
            </p>
            <DataTable
              label={`Activity on this ${noun}`}
              columns={columns(now)}
              rows={list.rows}
              rowKey={(event) => event.id}
            />
            <Pager label="Activity" list={list} />
            {list.loadMoreFailed ? <LoadMoreFailed noun="activity" /> : null}
          </div>
        )
      }
    </ListGate>
  );
}
