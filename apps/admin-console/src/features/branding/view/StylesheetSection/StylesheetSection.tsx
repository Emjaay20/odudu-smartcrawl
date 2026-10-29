import type { ThemeView } from '@odudu/contracts/admin';
import {
  sourceReading,
  STYLESHEET_LABEL,
  STYLESHEET_LEAD,
  STYLESHEET_SECTION_TITLE,
  type ThemeScope,
} from '#/features/branding/service';
import type { Stylesheet } from '#/features/branding/usecase/useStylesheet';
import { CodeField } from '#/shared/view/CodeField';
import { SaveSection } from '#/shared/view/SaveSection';

export function StylesheetSection({
  scope,
  view,
  stylesheet,
}: {
  scope: ThemeScope;
  view: ThemeView;
  stylesheet: Stylesheet;
}) {
  const { save, problems } = stylesheet;
  return (
    <SaveSection
      title={STYLESHEET_SECTION_TITLE}
      description={STYLESHEET_LEAD}
      blocked={stylesheet.blocked}
      save={save}
    >
      <CodeField
        label={STYLESHEET_LABEL}
        description={`${sourceReading(scope, view, 'stylesheet')}.`}
        language="css"
        value={stylesheet.text}
        size={stylesheet.size}
        issues={problems.lines}
        error={problems.message}
        changed={stylesheet.changed}
        onChange={stylesheet.edit}
      />
    </SaveSection>
  );
}
