import type { Client, LogoutDelivery } from '@odudu/contracts/admin';
import {
  attemptsText,
  DELIVERIES_HEADING,
  DELIVERIES_RULE,
  deliveryTone,
  NO_DELIVERIES,
  STATUS_OPTIONS,
} from '#/features/clients/service';
import {
  useClientDeliveries,
  type ClientDeliveries,
} from '#/features/clients/usecase/useClientDeliveries';
import { Button } from '#/shared/view/Button';
import { DataTable, type Column } from '#/shared/view/DataTable';
import { SelectField } from '#/shared/view/Field';
import { LoadFailed } from '#/shared/view/LoadFailed';
import { Panel } from '#/shared/view/Panel';
import { TableSkeleton } from '#/shared/view/Skeleton';
import { StatusTag } from '#/shared/view/StatusTag';
import { Timestamp } from '#/shared/view/Timestamp';
import { recordTab } from '#/shared/view/RecordTab';

const COLUMNS: readonly Column<LogoutDelivery>[] = [
  {
    id: 'endpoint',
    header: 'Address',
    isRowHeader: true,
    cell: (delivery) => <code>{delivery.endpoint}</code>,
  },
  {
    id: 'status',
    header: 'Status',
    cell: (delivery) => (
      <StatusTag tone={deliveryTone(delivery.status)}>{delivery.status}</StatusTag>
    ),
  },
  { id: 'attempts', header: 'Attempts', cell: (delivery) => attemptsText(delivery.attempts) },
  {
    id: 'last_error',
    header: 'Last error',
    secondary: true,
    cell: (delivery) => delivery.last_error ?? '—',
  },
  {
    id: 'created_at',
    header: 'Queued',
    secondary: true,
    cell: (delivery) => <Timestamp value={delivery.created_at} />,
  },
];

function Rows({ client, page }: { client: Client; page: ClientDeliveries }) {
  const { list } = page;
  switch (list.status) {
    case 'loading':
      return <TableSkeleton label="Loading deliveries" columns={COLUMNS} rows={2} />;
    case 'refused':
    case 'failed':
      return <LoadFailed title="The deliveries could not be loaded" retry={list.retry} />;
    case 'ready':
      break;
  }
  if (list.rows.length === 0) return <p className={recordTab.rule}>{NO_DELIVERIES}</p>;
  return (
    <>
      <DataTable
        label={`Logout deliveries of ${client.name}`}
        columns={COLUMNS}
        rows={list.rows}
        rowKey={(delivery) => delivery.id}
      />
      {list.more ? (
        <div className={recordTab.actions}>
          <Button isDisabled={list.loadingMore} onPress={list.loadMore}>
            {list.loadingMore ? 'Loading more deliveries…' : 'Load more deliveries'}
          </Button>
        </div>
      ) : null}
    </>
  );
}

export function Deliveries({ tenant, client }: { tenant: string; client: Client }) {
  const page = useClientDeliveries(tenant, client);
  return (
    <Panel title={DELIVERIES_HEADING}>
      <p className={recordTab.rule}>{DELIVERIES_RULE}</p>
      <SelectField
        label="Show"
        options={STATUS_OPTIONS}
        value={page.status}
        onChange={page.setStatus}
      />
      <Rows client={client} page={page} />
    </Panel>
  );
}
