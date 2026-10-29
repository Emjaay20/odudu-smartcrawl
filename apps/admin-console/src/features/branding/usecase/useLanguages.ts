import type { Settings } from '@odudu/contracts/admin';
import { useState } from 'react';
import { useRefusal } from '#/features/session';
import { languagesSave } from '#/features/branding/repository/languagesSave';
import { useOverrideList, useOverrideWrites } from '#/features/branding/repository/useOverrides';
import {
  askedRemoval,
  clearedOverrideError,
  EMPTY_OVERRIDE,
  hasProblems,
  languageFields,
  languageSettingsOf,
  languagesOf,
  languagesHold,
  LANGUAGES_SECTION,
  LANGUAGES_TITLE,
  openingLocale,
  overrideProblems,
  removeOutcome,
  saveOutcome,
  shownLocale,
  type LanguageValues,
  type OverrideErrors,
  type OverrideValues,
} from '#/features/branding/service';
import { useToast } from '#/shared/repository/useToasts';
import { useSectionSave, type SectionSave } from '#/shared/repository/useSectionSave';
import { writeRefusal } from '#/shared/service/capabilities';
import { TENANT_SETTINGS_RECORD } from '#/shared/service/tenantSettings';
import { useAnnouncedAction } from '#/shared/usecase/useAnnouncedAction';

export interface LanguagesInput {
  tenant: string;
  data: Settings;
  etag: string;
  gone: boolean;
}

export interface LanguagesSection {
  save: SectionSave<LanguageValues>;
  hold: string | undefined;
}

// The tenant's supported and default languages, saved as settings.
export function useLanguagesSection({
  tenant,
  data,
  etag,
  gone,
}: LanguagesInput): LanguagesSection {
  const refusal = useRefusal(tenant);
  const save = useSectionSave({
    tenant,
    record: TENANT_SETTINGS_RECORD,
    section: LANGUAGES_SECTION,
    label: LANGUAGES_TITLE,
    etag,
    capability: 'manage-tenant',
    gone,
    refusal,
    explain: writeRefusal,
    fields: languageFields(languagesOf(languageSettingsOf(data))),
    save: languagesSave(tenant),
  });
  return { save, hold: languagesHold(save.values) };
}

export interface Overrides {
  locale: string;
  pick: (locale: string) => void;
  list: ReturnType<typeof useOverrideList>;
  values: OverrideValues;
  errors: OverrideErrors;
  message: string | null;
  edit: (field: keyof OverrideValues, value: string) => void;
  fill: (override: OverrideValues) => void;
  saving: boolean;
  save: () => void;
  removing: { locale: string; key: string } | null;
  consequence: string;
  removeBusy: boolean;
  removeProblem: string | null;
  notice: string | null;
  removed: number;
  ask: (override: { locale: string; key: string }) => void;
  cancel: () => void;
  confirm: () => Promise<boolean>;
}

// The overrides of one language: the table, the form that sets one, and the
// removal of one.
export function useOverrides(tenant: string, data: Settings): Overrides {
  const refusal = useRefusal(tenant);
  const toast = useToast();
  const [picked, setPicked] = useState<string | null>(null);
  const languages = languageSettingsOf(data);
  const locale = shownLocale(picked, languages.supported_locales, openingLocale(languages));
  const list = useOverrideList(tenant, locale);
  const writes = useOverrideWrites(tenant);
  const [values, setValues] = useState(EMPTY_OVERRIDE);
  const [errors, setErrors] = useState<OverrideErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const action = useAnnouncedAction<{ locale: string; key: string }>({
    refusal,
    capability: 'manage-tenant',
    send: (asked) => writes.remove.run(asked),
    outcomeOf: (_asked, result) => removeOutcome(result),
  });
  return {
    locale,
    pick: setPicked,
    list,
    values,
    errors,
    message,
    edit: (field, value) => {
      setValues((was) => ({ ...was, [field]: value }));
      setErrors((was) => clearedOverrideError(was, field));
    },
    fill: (override) => {
      setValues(override);
      setErrors({});
      setMessage(null);
    },
    saving: writes.put.busy,
    save: () => {
      const problems = overrideProblems(values);
      setErrors(problems);
      setMessage(null);
      if (hasProblems(problems)) return;
      const sent = { locale, key: values.key.trim(), message: values.message };
      writes.put
        .run(sent)
        .then((result) => {
          const outcome = saveOutcome(result, sent, values);
          setErrors(outcome.errors);
          setMessage(outcome.message);
          setValues(outcome.values);
          if (outcome.toast !== null) toast.succeeded(outcome.toast);
          if (outcome.report) refusal.report(result, 'manage-tenant');
        })
        .catch(() => undefined);
    },
    removing: action.asked,
    consequence: askedRemoval(action.asked),
    removeBusy: writes.remove.busy,
    removeProblem: action.problem,
    notice: action.notice,
    removed: action.done,
    ask: action.ask,
    cancel: action.cancel,
    confirm: action.confirm,
  };
}
