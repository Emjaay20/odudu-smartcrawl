import type { ClientScope } from '@odudu/contracts/admin';
import {
  useScopeMapperSet,
  useScopeMappersRead,
  type ScopeMapperSet,
} from '#/features/scopes/usecase/useScopeMappers';
import { Button } from '#/shared/view/Button';
import { ChecklistField } from '#/shared/view/ChecklistField';
import { EmptyState } from '#/shared/view/EmptyState';
import { Section } from '#/shared/view/Section';
import { SectionNoticeOf } from '#/shared/view/SectionNoticeOf';
import { FormSkeleton } from '#/shared/view/Skeleton';
import styles from '#/features/scopes/view/ScopeRecordPage/Tab.module.css';

function Mappers({ name, set }: { name: string; set: ScopeMapperSet }) {
  const s = set.save;
  return (
    <Section
      title="Claim mappers"
      description={`The mappers that build the claims a token granted ${name} carries.`}
      dirty={s.dirty}
      saving={s.saving}
      onSave={s.submit}
      onDiscard={s.discard}
      restored={s.restored}
      blocked={s.blocked}
      notice={<SectionNoticeOf title="Claim mappers" save={s} />}
    >
      <p className={styles.rule}>{set.summary}</p>
      <ChecklistField
        label="Bound mappers"
        options={set.options}
        value={s.values.mapper_names}
        error={s.fieldErrors.mapper_names}
        changed={s.changed.includes('mapper_names')}
        onChange={set.choose}
      />
    </Section>
  );
}

function Ready({
  tenant,
  scope,
  ...read
}: {
  tenant: string;
  scope: ClientScope;
  data: Parameters<typeof useScopeMapperSet>[0]['data'];
  etag: string;
  gone: boolean;
}) {
  const set = useScopeMapperSet({ tenant, id: scope.id, ...read });
  return <Mappers name={scope.name} set={set} />;
}

export function MappersTab({ tenant, scope }: { tenant: string; scope: ClientScope }) {
  const read = useScopeMappersRead(tenant, scope.id);
  if (read.status === 'loading') return <FormSkeleton label="Loading the mappers" fields={2} />;
  if (read.data === undefined || read.etag === null) {
    return (
      <EmptyState
        variant="failed"
        title="The claim mappers could not be loaded"
        action={<Button onPress={read.retry}>Try again</Button>}
      >
        The gateway did not answer, or answered with an error.
      </EmptyState>
    );
  }
  return (
    <div className={styles.tab}>
      <Ready tenant={tenant} scope={scope} data={read.data} etag={read.etag} gone={read.gone} />
    </div>
  );
}
