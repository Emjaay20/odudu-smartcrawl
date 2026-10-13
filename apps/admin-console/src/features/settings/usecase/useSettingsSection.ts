import type { Settings } from '@odudu/contracts/admin';
import { useState } from 'react';
import { usePrincipal, useRefusal } from '#/features/session';
import { settingsSave, type SectionValues } from '#/features/settings/repository/settingsSave';
import { disablesTenant, settingEntries, type SettingsSection } from '#/features/settings/service';
import {
  useSectionSave,
  type SectionFields,
  type SectionSave,
} from '#/shared/repository/useSectionSave';
import { writeRefusal } from '#/shared/service/capabilities';
import { disableConsequence } from '#/shared/service/tenantEnabled';
import { TENANT_SETTINGS_RECORD } from '#/shared/service/tenantSettings';

export type SettingsSave = SectionSave<SectionValues>;

interface SectionInput {
  tenant: string;
  section: SettingsSection;
  data: Settings;
  etag: string;
  gone: boolean;
}

export function useSettingsSection({
  tenant,
  section,
  data,
  etag,
  gone,
}: SectionInput): SettingsSave {
  const refusal = useRefusal(tenant);
  const fields: SectionFields<SectionValues> = Object.fromEntries(
    settingEntries(section.fields, data).map((entry) => [
      entry.name,
      { value: entry.value, label: entry.label, kind: 'plain', describe: entry.describe },
    ]),
  );
  return useSectionSave({
    tenant,
    record: TENANT_SETTINGS_RECORD,
    section: section.id,
    label: section.title,
    etag,
    capability: 'manage-tenant',
    gone,
    refusal,
    explain: writeRefusal,
    fields,
    save: settingsSave(tenant),
  });
}

export interface GeneralSection {
  save: SettingsSave;
  // Switching the tenant off is asked about before it is saved.
  confirming: boolean;
  consequence: string;
  submit: () => boolean;
  confirm: () => void;
  cancel: () => void;
}

export function useGeneralSection(input: SectionInput): GeneralSection {
  const save = useSettingsSection(input);
  const principal = usePrincipal();
  const [confirming, setConfirming] = useState(false);
  return {
    save,
    confirming,
    consequence: disableConsequence(input.tenant, principal.tenant === input.tenant),
    submit: () => {
      if (disablesTenant(input.data.enabled, save.values.enabled)) {
        setConfirming(true);
        return false;
      }
      return save.submit();
    },
    confirm: () => {
      setConfirming(false);
      save.submit();
    },
    cancel: () => {
      setConfirming(false);
    },
  };
}
