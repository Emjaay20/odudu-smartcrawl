import type { Subject } from '@odudu/contracts/admin';
import {
  useCapabilityEditor,
  useSubjectRolesRead,
  type CapabilityEditing,
} from '#/features/subjects/usecase/useCapabilities';
import { Link } from 'react-aria-components';
import { Button } from '#/shared/view/Button';
import { ConfirmDialog } from '#/shared/view/ConfirmDialog';
import { ChecklistField } from '#/shared/view/ChecklistField';
import { ReadOnlyFields } from '#/shared/view/Field';
import { ReadGate } from '#/shared/view/ReadGate';
import { SaveSection } from '#/shared/view/SaveSection';
import { recordTab } from '#/shared/view/RecordTab';

export function CapabilitySection({ editing }: { editing: CapabilityEditing }) {
  const s = editing.save;
  const locked = editing.canManage && editing.beyond.length > 0;
  return (
    <SaveSection
      title="Admin capabilities"
      description="What this subject may do through the admin API and this console, assigned to the subject itself. Holdings through a group or another role are named beside each, and change where they come from."
      save={s}
    >
      {locked ? <p className={recordTab.rule}>{editing.beyondText}</p> : null}
      {editing.rolesFailed === null ? null : (
        <p role="alert" className={recordTab.rule}>
          The admin roles could not be read, so nothing can be saved.{' '}
          <Button size="small" variant="quiet" onPress={editing.rolesFailed.retry}>
            Read them again
          </Button>
        </p>
      )}
      <ReadOnlyFields when={!editing.canManage}>
        <ChecklistField
          label={`Assigned to ${editing.name}`}
          options={editing.options}
          value={s.values.capabilities}
          changed={s.changed.includes('capabilities')}
          isDisabled={locked}
          onChange={editing.choose}
        />
      </ReadOnlyFields>
      {editing.elsewhere.length === 0 ? null : (
        <p className={recordTab.rule}>
          {editing.elsewhereText}
          <Link href={editing.groupsHref}>Groups</Link> or{' '}
          <Link href={editing.rolesHref}>Roles</Link> tab.
        </p>
      )}
      <ConfirmDialog
        isOpen={editing.confirming !== null}
        title={editing.confirming?.title ?? ''}
        consequence={editing.confirming?.consequence ?? ''}
        confirmLabel="Save Admin capabilities"
        tone="danger"
        {...(typeof editing.confirming?.typed === 'string'
          ? { typed: editing.confirming.typed }
          : {})}
        onConfirm={editing.confirm}
        onCancel={editing.cancel}
      />
    </SaveSection>
  );
}

function Ready({
  tenant,
  subject,
  authorityTenant,
  self,
  ...read
}: {
  tenant: string;
  subject: Subject;
  authorityTenant: string;
  self: boolean;
  data: Parameters<typeof useCapabilityEditor>[0]['data'];
  etag: string;
  gone: boolean;
}) {
  const editing = useCapabilityEditor({ tenant, subject, authorityTenant, self, ...read });
  return <CapabilitySection editing={editing} />;
}

// A subject's admin capabilities on their own, wherever its holders are listed.
export function SubjectCapabilities({
  tenant,
  subject,
  authorityTenant = tenant,
  self,
}: {
  tenant: string;
  subject: Subject;
  authorityTenant?: string;
  self: boolean;
}) {
  const read = useSubjectRolesRead(tenant, subject.id);
  return (
    <ReadGate
      read={read}
      label="Loading the admin capabilities"
      fields={2}
      failed="The admin capabilities could not be loaded"
    >
      {(data, etag) => (
        <Ready
          tenant={tenant}
          subject={subject}
          authorityTenant={authorityTenant}
          self={self}
          data={data}
          etag={etag}
          gone={read.gone}
        />
      )}
    </ReadGate>
  );
}
