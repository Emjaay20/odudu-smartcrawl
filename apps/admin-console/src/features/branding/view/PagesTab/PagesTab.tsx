import type { ThemeView } from '@odudu/contracts/admin';
import {
  formNote,
  MANIFESTS,
  MESSAGE_NOTE,
  OPTIONAL_NOTE,
  PAGE_KIND_LABELS,
  PAGE_KIND_OPTIONS,
  PAGE_PICKER_LABEL,
  PAGES_LEAD,
  PARTS_TITLE,
  REQUIRED_NOTE,
  slot,
  sourceReading,
  TEMPLATE_LABEL,
  TEMPLATE_RULES,
  TEMPLATES_INTRO,
  TEMPLATES_SECTION_TITLE,
  templateDescription,
  templateField,
  pageKindOf,
  type PageKind,
  type ThemeScope,
} from '#/features/branding/service';
import { useTemplates } from '#/features/branding/usecase/useTemplates';
import { SelectField, TextAreaField } from '#/shared/view/Field';
import { Panel } from '#/shared/view/Panel';
import { recordTab } from '#/shared/view/RecordTab';
import { SaveSection } from '#/shared/view/SaveSection';
import styles from '#/features/branding/view/PagesTab/PagesTab.module.css';

function Parts({ kind }: { kind: PageKind }) {
  const manifest = MANIFESTS[kind];
  const inside = formNote(manifest);
  return (
    <Panel title={PARTS_TITLE}>
      <p className={recordTab.rule}>{TEMPLATES_INTRO}</p>
      <p className={recordTab.text}>{REQUIRED_NOTE}</p>
      <ul className={styles.parts}>
        {manifest.required.map((part) => (
          <li key={part}>
            <code>{slot(part)}</code>
          </li>
        ))}
      </ul>
      {manifest.optional.length === 0 ? null : (
        <>
          <p className={recordTab.text}>{OPTIONAL_NOTE}</p>
          <ul className={styles.parts}>
            {manifest.optional.map((part) => (
              <li key={part}>
                <code>{slot(part)}</code>
              </li>
            ))}
          </ul>
        </>
      )}
      {inside === null ? null : <p className={recordTab.rule}>{inside}</p>}
      <p className={recordTab.rule}>{MESSAGE_NOTE}</p>
      <p className={recordTab.rule}>{TEMPLATE_RULES}</p>
    </Panel>
  );
}

export function PagesTab({
  tenant,
  scope,
  view,
  tag,
  gone,
  kind,
  onKind,
}: {
  tenant: string;
  scope: ThemeScope;
  view: ThemeView;
  tag: string;
  gone: boolean;
  kind: PageKind;
  onKind: (kind: PageKind) => void;
}) {
  const templates = useTemplates({ tenant, scope, view, tag, gone });
  const { save } = templates;
  return (
    <div className={styles.tab}>
      <SaveSection title={TEMPLATES_SECTION_TITLE} description={PAGES_LEAD} save={save}>
        <SelectField
          label={PAGE_PICKER_LABEL}
          options={PAGE_KIND_OPTIONS}
          value={kind}
          onChange={(id) => {
            const next = pageKindOf(id);
            if (next !== undefined) onKind(next);
          }}
        />
        <TextAreaField
          label={`${PAGE_KIND_LABELS[kind]}: ${TEMPLATE_LABEL.toLowerCase()}`}
          description={`${sourceReading(scope, view, templateField(kind))}. ${templateDescription()}`}
          mono
          value={templates.text(kind)}
          error={templates.issue(kind)}
          changed={templates.changed(kind)}
          onChange={(text) => {
            templates.edit(kind, text);
          }}
        />
      </SaveSection>
      <Parts kind={kind} />
    </div>
  );
}
