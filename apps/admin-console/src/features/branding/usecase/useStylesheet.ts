import type { FieldError, ThemeView } from '@odudu/contracts/admin';
import { useState } from 'react';
import { useRefusal } from '#/features/session';
import { stylesheetSave } from '#/features/branding/repository/themeSaves';
import {
  refusalErrors,
  stylesheetFields,
  stylesheetHold,
  stylesheetProblems,
  stylesheetSize,
  stylesheetValues,
  STYLESHEET_PATH,
  STYLESHEET_SECTION_TITLE,
  themeRecord,
  type Size,
  type PlacedProblems,
  type StylesheetValues,
  type ThemeScope,
} from '#/features/branding/service';
import { useSectionSave, type SectionSave } from '#/shared/repository/useSectionSave';
import { writeRefusal } from '#/shared/service/capabilities';

export interface Stylesheet {
  save: SectionSave<StylesheetValues>;
  text: string;
  size: Size;
  blocked: string | undefined;
  // What the server refused in it, with the lines to mark.
  problems: PlacedProblems;
  edit: (text: string) => void;
  changed: boolean;
}

export function useStylesheet({
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
}): Stylesheet {
  const refusal = useRefusal(tenant);
  const [refused, setRefused] = useState<readonly FieldError[]>([]);
  const save = useSectionSave({
    tenant,
    record: themeRecord(scope),
    section: 'stylesheet',
    label: STYLESHEET_SECTION_TITLE,
    etag: tag,
    capability: 'manage-tenant',
    gone,
    refusal,
    explain: writeRefusal,
    fields: stylesheetFields(stylesheetValues(view)),
    save: (gateway, input) =>
      stylesheetSave(
        tenant,
        scope,
        view,
      )(gateway, input).then((result) => {
        setRefused(refusalErrors(result));
        return result;
      }),
  });
  const text = save.values.stylesheet;
  return {
    save,
    text,
    size: stylesheetSize(text),
    blocked: stylesheetHold(text),
    problems: stylesheetProblems(refused, save.fieldErrors[STYLESHEET_PATH]),
    edit: (next) => {
      save.edit('stylesheet', next);
    },
    changed: save.changed.includes('stylesheet'),
  };
}
