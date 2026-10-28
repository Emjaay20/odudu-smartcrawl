import type { ThemeView } from '@odudu/contracts/admin';
import { useRefusal } from '#/features/session';
import { templateSave } from '#/features/branding/repository/themeSaves';
import {
  limitedIssues,
  templateField,
  templateFields,
  templateValues,
  TEMPLATES_SECTION_TITLE,
  themeRecord,
  type PageKind,
  type TemplateValues,
  type ThemeScope,
} from '#/features/branding/service';
import { useSectionSave, type SectionSave } from '#/shared/repository/useSectionSave';
import { writeRefusal } from '#/shared/service/capabilities';

export interface Templates {
  save: SectionSave<TemplateValues>;
  text: (kind: PageKind) => string;
  // What the server refused in this kind's template, by path and place.
  issue: (kind: PageKind) => string | undefined;
  edit: (kind: PageKind, text: string) => void;
  changed: (kind: PageKind) => boolean;
}

export function useTemplates({
  tenant,
  scope,
  view,
  tag,
  gone,
}: {
  tenant: string;
  scope: ThemeScope;
  view: ThemeView;
  tag: string;
  gone: boolean;
}): Templates {
  const refusal = useRefusal(tenant);
  const save = useSectionSave({
    tenant,
    record: themeRecord(scope),
    section: 'templates',
    label: TEMPLATES_SECTION_TITLE,
    etag: tag,
    capability: 'manage-tenant',
    gone,
    refusal,
    explain: writeRefusal,
    fields: templateFields(templateValues(view)),
    save: templateSave(tenant, scope, view),
  });
  return {
    save,
    text: (kind) => save.values[templateField(kind)],
    issue: (kind) => limitedIssues(save.fieldErrors[templateField(kind)]),
    edit: (kind, text) => {
      save.edit(templateField(kind), text);
    },
    changed: (kind) => save.changed.includes(templateField(kind)),
  };
}
