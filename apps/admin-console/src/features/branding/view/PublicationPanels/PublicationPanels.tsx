import type { ThemeView } from '@odudu/contracts/admin';
import {
  draftText,
  ISSUES_LABEL,
  NO_VERSIONS,
  PUBLISH_BODY,
  PUBLISH_LABEL,
  PUBLISH_TITLE,
  PUBLISHING,
  publishedTag,
  publishedText,
  RESET_CONFIRM,
  RESET_LABEL,
  RESET_TITLE,
  resetBody,
  resetLead,
  RESTORE_LABEL,
  restoreBody,
  restoreName,
  restoreTitle,
  STATUS_TITLE,
  VERSIONS_COLUMNS,
  VERSIONS_FAILED,
  VERSIONS_TABLE_LABEL,
  VERSIONS_TITLE,
  versionRows,
  versionsLead,
  WARNINGS_NOTE,
  WARNINGS_TITLE,
  type ThemeScope,
  type VersionRow,
} from '#/features/branding/service';
import type { Publication } from '#/features/branding/usecase/usePublication';
import type { Versions } from '#/features/branding/usecase/useVersions';
import type { Removal } from '#/shared/usecase/useConfirmedChange';
import { Button } from '#/shared/view/Button';
import { ConfirmDialog } from '#/shared/view/ConfirmDialog';
import { DataTable, type Column } from '#/shared/view/DataTable';
import { InlineFailed } from '#/shared/view/InlineFailed';
import { Note } from '#/shared/view/Note';
import { Panel } from '#/shared/view/Panel';
import { recordTab } from '#/shared/view/RecordTab';
import { FormSkeleton } from '#/shared/view/Skeleton';
import { StatusTag } from '#/shared/view/StatusTag';
import styles from '#/features/branding/view/PublicationPanels/PublicationPanels.module.css';

export function StatusPanel({ view }: { view: ThemeView }) {
  const tag = publishedTag(view);
  return (
    <Panel title={STATUS_TITLE}>
      <p className={recordTab.text}>
        <StatusTag tone={tag.tone}>{tag.text}</StatusTag> {publishedText(view)}
      </p>
      <p className={recordTab.rule}>{draftText(view)}</p>
    </Panel>
  );
}

export function PublishPanel({ publication }: { publication: Publication }) {
  const { outcome } = publication;
  return (
    <Panel title={PUBLISH_TITLE}>
      <p className={recordTab.rule}>{PUBLISH_BODY}</p>
      {publication.hold === undefined ? null : <Note tone="warning">{publication.hold}</Note>}
      <div className={recordTab.actions}>
        <Button
          variant="primary"
          isDisabled={publication.busy || publication.hold !== undefined}
          onPress={publication.publish}
        >
          {publication.busy ? PUBLISHING : PUBLISH_LABEL}
        </Button>
      </div>
      <div role="status" className={styles.outcome}>
        {outcome.message === null ? null : <p className={styles.refused}>{outcome.message}</p>}
        {outcome.issues.lines.length === 0 ? null : (
          <>
            <p className={recordTab.rule}>{ISSUES_LABEL}</p>
            <ul className={styles.issues}>
              {outcome.issues.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            {outcome.issues.more === null ? null : (
              <p className={recordTab.rule}>{outcome.issues.more}</p>
            )}
          </>
        )}
        {outcome.warnings.length === 0 ? null : (
          <>
            <p className={recordTab.text}>
              <strong>{WARNINGS_TITLE}</strong>
            </p>
            <p className={recordTab.rule}>{WARNINGS_NOTE}</p>
            <ul className={styles.issues}>
              {outcome.warnings.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Panel>
  );
}

const COLUMNS = (ask: (row: VersionRow) => void): readonly Column<VersionRow>[] => [
  { id: 'version', header: VERSIONS_COLUMNS.version, isRowHeader: true, cell: (row) => row.name },
  {
    id: 'state',
    header: VERSIONS_COLUMNS.state,
    cell: (row) => <StatusTag tone={row.tone}>{row.state}</StatusTag>,
  },
  { id: 'when', header: VERSIONS_COLUMNS.when, secondary: true, cell: (row) => row.when },
  {
    id: 'action',
    header: VERSIONS_COLUMNS.action,
    cell: (row) =>
      row.restorable ? (
        <Button
          size="small"
          aria-label={restoreName(row.name)}
          onPress={() => {
            ask(row);
          }}
        >
          {RESTORE_LABEL}
        </Button>
      ) : null,
  },
];

export function VersionsPanel({ versions }: { versions: Versions }) {
  const { read, restoring } = versions;
  const asked = restoring.asking;
  return (
    <Panel title={VERSIONS_TITLE}>
      <p className={recordTab.rule}>{versionsLead()}</p>
      {read.status === 'loading' ? <FormSkeleton label="Loading the versions" fields={2} /> : null}
      {read.status === 'failed' ? (
        <InlineFailed message={VERSIONS_FAILED} retry={read.retry} />
      ) : null}
      {read.status === 'ready' ? (
        <DataTable
          label={VERSIONS_TABLE_LABEL}
          columns={COLUMNS(restoring.ask)}
          rows={versionRows(read.data.items)}
          rowKey={(row) => row.id}
          empty={<p className={recordTab.rule}>{NO_VERSIONS}</p>}
        />
      ) : null}
      <ConfirmDialog
        isOpen={asked !== null}
        title={asked === null ? '' : restoreTitle(asked)}
        consequence={asked === null ? '' : restoreBody(asked)}
        confirmLabel={RESTORE_LABEL}
        tone="primary"
        busy={restoring.busy}
        problem={restoring.problem}
        onConfirm={restoring.confirm}
        onCancel={restoring.cancel}
      />
    </Panel>
  );
}

export function ResetPanel({ scope, reset }: { scope: ThemeScope; reset: Removal }) {
  return (
    <Panel title={RESET_TITLE}>
      <p className={recordTab.rule}>{resetLead(scope)}</p>
      <div className={recordTab.actions}>
        <Button variant="danger" onPress={reset.ask}>
          {RESET_LABEL}
        </Button>
      </div>
      <ConfirmDialog
        isOpen={reset.confirming}
        title={`${RESET_TITLE}?`}
        consequence={resetBody(scope)}
        confirmLabel={RESET_CONFIRM}
        tone="danger"
        busy={reset.busy}
        problem={reset.problem}
        onConfirm={reset.confirm}
        onCancel={reset.cancel}
      />
    </Panel>
  );
}
