import type { AuditEvent } from '@odudu/contracts/admin';
import type { ResourceListState } from '#/shared/service/resourceList';
import { auditColumns, AuditTable } from '#/shared/view/AuditTable';
import { EmptyState } from '#/shared/view/EmptyState';
import { ListGate } from '#/shared/view/ListGate';
import { LoadMoreFailed } from '#/shared/view/LoadMore';
import { Pager } from '#/shared/view/Pager';
import { TableSkeleton } from '#/shared/view/Skeleton';
import styles from '#/shared/view/ActivityTab/ActivityTab.module.css';

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
      loading={<TableSkeleton label="Loading activity" columns={auditColumns({ now })} />}
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
            <AuditTable
              label={`Activity on this ${noun}`}
              rows={list.rows}
              {...(now === undefined ? {} : { now })}
            />
            <Pager label="Activity" list={list} />
            {list.loadMoreFailed ? <LoadMoreFailed noun="activity" /> : null}
          </div>
        )
      }
    </ListGate>
  );
}
