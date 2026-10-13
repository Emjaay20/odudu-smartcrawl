import { useEffect, useId, useRef } from 'react';
import { AreaGate, areaAt } from '#/features/shell';
import {
  ALG_OPTIONS,
  LANES,
  STAGE_RULE,
  TITLE,
  type Lane as LaneSpec,
} from '#/features/signing-keys/service';
import {
  useSigningKeysPage,
  type KeyRow,
  type Lane,
  type SigningKeysPage as Page,
} from '#/features/signing-keys/usecase/useSigningKeysPage';
import { Button } from '#/shared/view/Button';
import { AskedDialog } from '#/shared/view/ConfirmDialog';
import { DataTable, type Column } from '#/shared/view/DataTable';
import { EmptyState } from '#/shared/view/EmptyState';
import { SelectField } from '#/shared/view/Field';
import { LoadFailed } from '#/shared/view/LoadFailed';
import { LoadMore } from '#/shared/view/LoadMore';
import { PageHeader } from '#/shared/view/PageHeader';
import { LiveMessage } from '#/shared/view/Message';
import { Panel } from '#/shared/view/Panel';
import { TableSkeleton } from '#/shared/view/Skeleton';
import { StatusTag } from '#/shared/view/StatusTag';
import { Timestamp } from '#/shared/view/Timestamp';
import styles from '#/features/signing-keys/view/SigningKeysPage/SigningKeysPage.module.css';

function columns(spec: LaneSpec, page: Page): readonly Column<KeyRow>[] {
  const common: readonly Column<KeyRow>[] = [
    {
      id: 'kid',
      header: 'Key',
      isRowHeader: true,
      cell: ({ key }) => <code className={styles.kid}>{key.kid}</code>,
    },
    { id: 'alg', header: 'Algorithm', cell: ({ key }) => key.alg },
    {
      id: 'created_at',
      header: 'Created',
      secondary: true,
      cell: ({ key }) => <Timestamp value={key.created_at} />,
    },
  ];
  const readiness: Column<KeyRow> = {
    id: 'readiness',
    header: 'Readiness',
    cell: ({ readiness: reading }) =>
      reading === null ? null : (
        <div className={styles.cell}>
          <StatusTag tone={reading.tone}>{reading.label}</StatusTag>
          <p className={styles.reading}>{reading.text}</p>
        </div>
      ),
  };
  const actions: Column<KeyRow> = {
    id: 'actions',
    header: 'Actions',
    cell: ({ key }) => {
      switch (spec.status) {
        case 'rotating':
          return (
            <div className={styles.actions}>
              <Button
                size="small"
                variant="quiet"
                aria-label={`Promote ${key.kid}`}
                onPress={() => {
                  page.ask('promote', key);
                }}
              >
                Promote
              </Button>
              <Button
                size="small"
                variant="quiet"
                aria-label={`Retire ${key.kid}`}
                onPress={() => {
                  page.ask('retire', key);
                }}
              >
                Retire
              </Button>
            </div>
          );
        case 'active':
          return <p className={styles.reading}>It cannot be retired while it is active.</p>;
        case 'retired':
          return (
            <Button
              size="small"
              variant="quiet"
              aria-label={`Delete ${key.kid}`}
              onPress={() => {
                page.ask('delete', key);
              }}
            >
              Delete
            </Button>
          );
      }
    },
  };
  return spec.status === 'rotating' ? [...common, readiness, actions] : [...common, actions];
}

function LaneBody({ spec, lane, page }: { spec: LaneSpec; lane: Lane; page: Page }) {
  const cols = columns(spec, page);
  const label = `${spec.title} keys`;
  switch (lane.status) {
    case 'loading':
      return <TableSkeleton label={`Loading ${label.toLowerCase()}`} columns={cols} rows={2} />;
    case 'refused':
    case 'failed':
      return <LoadFailed title={`${label} could not be loaded`} retry={lane.retry} unchanged />;
    case 'ready':
      break;
  }
  if (lane.rows.length === 0) {
    return (
      <EmptyState variant="nothing-yet" title={`No ${label.toLowerCase()}`}>
        {spec.empty}
      </EmptyState>
    );
  }
  return (
    <>
      <DataTable label={label} columns={cols} rows={lane.rows} rowKey={({ key }) => key.id} />
      {lane.next === null ? null : (
        <div>
          <LoadMore noun={label.toLowerCase()} loading={lane.loadingMore} onPress={lane.loadMore} />
        </div>
      )}
      {lane.loadMoreFailed ? (
        <p role="alert" className={styles.failed}>
          {`More ${label.toLowerCase()} could not be loaded. Load more tries again.`}
        </p>
      ) : null}
    </>
  );
}

function LaneSection({ spec, page }: { spec: LaneSpec; page: Page }) {
  const heading = useId();
  return (
    <section aria-labelledby={heading} className={styles.lane}>
      <h2 id={heading} className={styles.heading}>
        {spec.title}
      </h2>
      <p className={styles.rule}>{spec.rule}</p>
      <LaneBody spec={spec} lane={page[spec.status]} page={page} />
    </section>
  );
}

function Stage({ page }: { page: Page }) {
  return (
    <Panel title="Stage a key">
      <p className={styles.rule}>{STAGE_RULE}</p>
      <div className={styles.stage}>
        <SelectField
          label="Algorithm"
          options={ALG_OPTIONS}
          value={page.alg}
          onChange={page.chooseAlg}
        />
        <Button variant="primary" isDisabled={page.staging} onPress={page.stage}>
          {page.staging ? 'Staging…' : 'Stage key'}
        </Button>
      </div>
      <LiveMessage label="Last stage">{page.stageMessage}</LiveMessage>
    </Panel>
  );
}

function Keys({ tenant }: { tenant: string }) {
  const page = useSigningKeysPage(tenant);
  const notice = useRef<HTMLParagraphElement>(null);
  // The row the action was pressed on took the focus with it, so the line
  // saying what happened holds it once the dialog that held it is gone.
  useEffect(() => {
    if (page.acted > 0) notice.current?.focus();
  }, [page.acted]);
  const { asking } = page;
  return (
    <>
      <PageHeader
        kicker={tenant}
        title={TITLE}
        description="The keys that sign this tenant’s tokens, and the ones published for relying parties to verify them."
      />
      <div className={styles.page}>
        <Stage page={page} />
        <p
          ref={notice}
          tabIndex={-1}
          role="status"
          aria-label="Last key action"
          className={styles.notice}
        >
          {page.notice}
        </p>
        {LANES.map((spec) => (
          <LaneSection key={spec.status} spec={spec} page={page} />
        ))}
      </div>
      <AskedDialog
        asked={asking?.dialog ?? null}
        busy={page.busy}
        problem={page.problem}
        onConfirm={() => {
          page.confirm().catch(() => undefined);
        }}
        onCancel={page.cancel}
      />
    </>
  );
}

export function SigningKeysPage({ tenant }: { tenant: string }) {
  return (
    <AreaGate tenant={tenant} area={areaAt('keys')} title={TITLE}>
      <Keys tenant={tenant} />
    </AreaGate>
  );
}
