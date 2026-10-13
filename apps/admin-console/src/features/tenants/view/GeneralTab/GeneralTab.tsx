import type { Tenant } from '#/features/tenants/service';
import { useTenantGeneral } from '#/features/tenants/usecase/useTenantGeneral';
import { Button } from '#/shared/view/Button';
import { ConfirmDialog } from '#/shared/view/ConfirmDialog';
import { TextField } from '#/shared/view/Field';
import { SaveSection } from '#/shared/view/SaveSection';
import { EnabledTag } from '#/shared/view/StatusTag';
import { Panel } from '#/shared/view/Panel';
import { recordTab } from '#/shared/view/RecordTab';
import styles from '#/features/tenants/view/GeneralTab/GeneralTab.module.css';
import { DESCRIPTION_RULE } from '#/shared/service/labels';

export function GeneralTab({
  name,
  tenant,
  etag,
  gone,
}: {
  name: string;
  tenant: Tenant;
  etag: string;
  gone: boolean;
}) {
  const { general: s, enabled } = useTenantGeneral(name, tenant, etag, gone);
  return (
    <div className={recordTab.tab}>
      <SaveSection
        title="General"
        description="What the console and the tenant's own pages call it. The name is fixed: it is in the issuer of every token the tenant has minted."
        save={s}
      >
        <dl className={recordTab.fixed}>
          <dt>Name</dt>
          <dd>
            <code>{name}</code>
          </dd>
        </dl>
        <TextField
          label="Display name"
          description={DESCRIPTION_RULE}
          value={s.values.display_name}
          error={s.fieldErrors.display_name}
          changed={s.changed.includes('display_name')}
          onChange={(value) => {
            s.edit('display_name', value);
          }}
        />
      </SaveSection>
      <Panel title="Status">
        <p className={recordTab.text}>
          <EnabledTag enabled={enabled.enabled} />{' '}
          {enabled.enabled
            ? `${name} is in service.`
            : `${name} answers as a tenant that does not exist until it is enabled again.`}
        </p>
        {enabled.fixed !== null ? (
          <p className={recordTab.rule}>{enabled.fixed}</p>
        ) : (
          <div className={recordTab.actions}>
            {/* One button whose label turns, so focus stays on it across the change. */}
            <Button
              variant={enabled.enabled ? 'danger' : 'secondary'}
              onPress={enabled.enabled ? enabled.ask : enabled.enable}
            >
              {enabled.enabled ? `Disable ${name}` : enabled.busy ? 'Enabling…' : `Enable ${name}`}
            </Button>
          </div>
        )}
        <p role="status" className={styles.message}>
          {enabled.message}
        </p>
      </Panel>
      <ConfirmDialog
        isOpen={enabled.confirming}
        title={`Disable ${name}?`}
        consequence={enabled.consequence}
        confirmLabel={`Disable ${name}`}
        tone="danger"
        typed={name}
        busy={enabled.busy}
        onConfirm={enabled.disable}
        onCancel={enabled.cancel}
      />
    </div>
  );
}
