import {
  INSTALLATION_HEADING,
  INSTALLATION_RULE,
  NONE,
  type InstallationRow,
} from '#/features/clients/service';
import { useInstallationPanel } from '#/features/clients/usecase/useClientInstallationPanel';
import { Button } from '#/shared/view/Button';
import { CopyValue } from '#/shared/view/CopyValue';
import { Panel } from '#/shared/view/Panel';
import { FormSkeleton } from '#/shared/view/Skeleton';
import { recordTab } from '#/shared/view/RecordTab';
import styles from '#/features/clients/view/Installation/Installation.module.css';

function Value({ row }: { row: InstallationRow }) {
  if (row.values.length === 0) return <span className={recordTab.rule}>{NONE}</span>;
  if (row.copy) {
    return (
      <>
        {row.values.map((value) => (
          <CopyValue key={value} label={row.label.toLowerCase()} value={value} />
        ))}
      </>
    );
  }
  return (
    <ul className={styles.values}>
      {row.values.map((value) => (
        <li key={value}>
          <code>{value}</code>
        </li>
      ))}
    </ul>
  );
}

export function Installation({ tenant, clientDbId }: { tenant: string; clientDbId: string }) {
  const panel = useInstallationPanel(tenant, clientDbId);
  return (
    <Panel title={INSTALLATION_HEADING}>
      <p className={recordTab.rule}>{INSTALLATION_RULE}</p>
      {panel.status === 'loading' ? (
        <FormSkeleton label="Loading the installation" fields={3} />
      ) : null}
      {panel.status === 'failed' ? (
        <div role="alert">
          <p className={recordTab.text}>The installation could not be loaded.</p>
          <Button onPress={panel.retry}>Try again</Button>
        </div>
      ) : null}
      {panel.status === 'ready' ? (
        <dl className={recordTab.fixed}>
          {panel.rows.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>
                <Value row={row} />
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </Panel>
  );
}
