import type { Settings } from '@odudu/contracts/admin';
import { AreaGate, areaAt } from '#/features/shell';
import {
  booleanOf,
  disableConsequence,
  fieldDescription,
  GENERAL_SECTION,
  listOf,
  numberOf,
  SETTINGS_SECTIONS,
  textOf,
  type SettingField,
  type SettingsSection,
} from '#/features/settings/service';
import { useSettingsPage } from '#/features/settings/usecase/useSettingsPage';
import {
  useGeneralSection,
  useSettingsSection,
  type SettingsSave,
} from '#/features/settings/usecase/useSettingsSection';
import { numberKept } from '#/shared/service/numbers';
import { disableFixed } from '#/shared/service/tenantEnabled';
import { Button } from '#/shared/view/Button';
import { ChecklistField } from '#/shared/view/ChecklistField';
import { ConfirmDialog } from '#/shared/view/ConfirmDialog';
import { EmptyState } from '#/shared/view/EmptyState';
import { NumberWithUnitField, SelectField, TextField, ToggleField } from '#/shared/view/Field';
import { FieldGrid, GridCell } from '#/shared/view/FieldGrid';
import { PageHeader } from '#/shared/view/PageHeader';
import { Section } from '#/shared/view/Section';
import { SectionNoticeOf } from '#/shared/view/SectionNoticeOf';
import { FormSkeleton } from '#/shared/view/Skeleton';
import styles from '#/features/settings/view/SettingsPage/SettingsPage.module.css';

const TITLE = 'Settings';

function Control({
  field,
  save,
  description,
  isDisabled,
}: {
  field: SettingField;
  save: SettingsSave;
  description?: string | undefined;
  isDisabled?: boolean;
}) {
  const shared = {
    label: field.label,
    description: description ?? fieldDescription(field),
    error: save.fieldErrors[field.name],
    changed: save.changed.includes(field.name),
    ...(isDisabled === undefined ? {} : { isDisabled }),
  };
  const value = save.values[field.name];
  switch (field.control) {
    case 'toggle':
      return (
        <ToggleField
          {...shared}
          value={booleanOf(value)}
          onChange={(next) => {
            save.edit(field.name, next);
          }}
        />
      );
    case 'text':
      return (
        <TextField
          {...shared}
          value={textOf(value)}
          onChange={(next) => {
            save.edit(field.name, next);
          }}
        />
      );
    case 'seconds':
    case 'count':
      return (
        <NumberWithUnitField
          {...shared}
          unit={field.control === 'seconds' ? 'seconds' : (field.unit ?? '')}
          value={numberOf(value)}
          onChange={(next) => {
            save.edit(field.name, numberKept(next, numberOf(value)));
          }}
        />
      );
    case 'choice':
      return (
        <SelectField
          {...shared}
          options={field.options ?? []}
          value={textOf(value)}
          onChange={(next) => {
            save.edit(field.name, next);
          }}
        />
      );
    case 'set':
      return (
        <ChecklistField
          {...shared}
          options={(field.options ?? []).map((option) => ({
            id: option.id,
            label: option.label,
            ...(option.fixed === undefined ? {} : { unavailable: option.fixed }),
          }))}
          value={listOf(value)}
          onChange={(next) => {
            save.edit(field.name, next);
          }}
        />
      );
  }
}

function Fields({
  section,
  save,
  fixed,
}: {
  section: SettingsSection;
  save: SettingsSave;
  fixed?: Readonly<Record<string, string>>;
}) {
  return (
    <FieldGrid>
      {section.fields.map((field) => {
        const why = fixed?.[field.name];
        return (
          <GridCell
            key={field.name}
            {...(field.control === 'set'
              ? { span: 'full' as const }
              : field.control === 'text' || field.control === 'choice'
                ? { span: 'wide' as const }
                : {})}
          >
            <Control
              field={field}
              save={save}
              {...(why === undefined ? {} : { description: why, isDisabled: true })}
            />
          </GridCell>
        );
      })}
    </FieldGrid>
  );
}

interface Props {
  tenant: string;
  data: Settings;
  etag: string;
  gone: boolean;
}

function Plain({ tenant, data, etag, gone, section }: Props & { section: SettingsSection }) {
  const save = useSettingsSection({ tenant, section, data, etag, gone });
  return (
    <Section
      title={section.title}
      description={section.description}
      dirty={save.dirty}
      saving={save.saving}
      onSave={save.submit}
      onDiscard={save.discard}
      restored={save.restored}
      blocked={save.blocked}
      notice={<SectionNoticeOf title={section.title} save={save} />}
    >
      <Fields section={section} save={save} />
    </Section>
  );
}

function General({ tenant, data, etag, gone, section }: Props & { section: SettingsSection }) {
  const general = useGeneralSection({ tenant, section, data, etag, gone });
  const s = general.save;
  const why = disableFixed(tenant);
  return (
    <>
      <Section
        title={section.title}
        description={section.description}
        dirty={s.dirty}
        saving={s.saving}
        onSave={general.submit}
        onDiscard={s.discard}
        restored={s.restored}
        blocked={s.blocked}
        notice={<SectionNoticeOf title={section.title} save={s} />}
      >
        <Fields section={section} save={s} {...(why === null ? {} : { fixed: { enabled: why } })} />
      </Section>
      <ConfirmDialog
        isOpen={general.confirming}
        title={`Disable ${tenant}?`}
        consequence={disableConsequence(tenant)}
        confirmLabel={`Disable ${tenant}`}
        tone="danger"
        typed={tenant}
        busy={s.saving}
        onConfirm={general.confirm}
        onCancel={general.cancel}
      />
    </>
  );
}

function Sections({ tenant }: { tenant: string }) {
  const settings = useSettingsPage(tenant);
  if (settings.status === 'loading')
    return <FormSkeleton label="Loading the settings" fields={4} />;
  if (settings.data === undefined || settings.etag === null) {
    return (
      <EmptyState
        variant="failed"
        title="The settings could not be loaded"
        action={<Button onPress={settings.retry}>Try again</Button>}
      >
        The gateway did not answer, or answered with an error.
      </EmptyState>
    );
  }
  const shared = { tenant, data: settings.data, etag: settings.etag, gone: settings.gone };
  return (
    <div className={styles.page}>
      {SETTINGS_SECTIONS.map((section) =>
        section.id === GENERAL_SECTION ? (
          <General key={section.id} {...shared} section={section} />
        ) : (
          <Plain key={section.id} {...shared} section={section} />
        ),
      )}
    </div>
  );
}

export function SettingsPage({ tenant }: { tenant: string }) {
  return (
    <AreaGate tenant={tenant} area={areaAt('settings')} title={TITLE}>
      <PageHeader
        kicker={tenant}
        title={TITLE}
        description="How this tenant signs people in, what it asks of their passwords, and how long it keeps what it records. Every section saves on its own."
      />
      <Sections tenant={tenant} />
    </AreaGate>
  );
}
