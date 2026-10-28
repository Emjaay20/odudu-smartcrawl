import { PALETTE_KEYS } from '@odudu/contracts';
import type { ThemeView } from '@odudu/contracts/admin';
import {
  CONTRAST_LEAD,
  CONTRAST_TITLE,
  PAIR_FAILS,
  PAIR_PASSES,
  rowText,
  type ContrastReport,
  COLOURS_LEAD,
  COLOURS_TITLE,
  colourProblems,
  customLabel,
  FONT_LABEL,
  FONT_OPTIONS,
  PALETTE_LABELS,
  paletteField,
  paletteLegend,
  SCHEME_LABELS,
  SCHEMES,
  sourceReading,
  type Scheme,
  type ThemeScope,
} from '#/features/branding/service';
import type { Colours } from '#/features/branding/usecase/useColours';
import { ColourField } from '#/features/branding/view/ColourField';
import { FieldGroup, SelectField, ToggleField } from '#/shared/view/Field';
import { FieldGrid, GridCell } from '#/shared/view/FieldGrid';
import { Panel } from '#/shared/view/Panel';
import { recordTab } from '#/shared/view/RecordTab';
import { SaveSection } from '#/shared/view/SaveSection';
import { StatusTag } from '#/shared/view/StatusTag';
import styles from '#/features/branding/view/ColoursSection/ColoursSection.module.css';

function SchemeGroup({
  scheme,
  scope,
  view,
  colours,
}: {
  scheme: Scheme;
  scope: ThemeScope;
  view: ThemeView;
  colours: Colours;
}) {
  const { save } = colours;
  const field = paletteField(scheme);
  const palette = save.values[field];
  const problems = colourProblems(palette);
  return (
    <FieldGroup label={paletteLegend(SCHEME_LABELS[scheme])}>
      <ToggleField
        label={customLabel(SCHEME_LABELS[scheme].toLowerCase())}
        description={sourceReading(scope, view, field)}
        value={palette !== null}
        error={save.fieldErrors[field]}
        changed={save.changed.includes(field)}
        onChange={(custom) => {
          colours.customise(scheme, custom);
        }}
      />
      {palette === null ? null : (
        <div className={styles.colours}>
          <FieldGrid>
            {PALETTE_KEYS.map((key) => (
              <GridCell key={key}>
                <ColourField
                  label={`${SCHEME_LABELS[scheme]} ${PALETTE_LABELS[key].label.toLowerCase()}`}
                  value={palette[key]}
                  error={problems[key]}
                  changed={false}
                  onChange={(text) => {
                    colours.setColour(scheme, key, text);
                  }}
                />
              </GridCell>
            ))}
          </FieldGrid>
        </div>
      )}
    </FieldGroup>
  );
}

export function ColoursSection({
  scope,
  view,
  colours,
}: {
  scope: ThemeScope;
  view: ThemeView;
  colours: Colours;
}) {
  const { save } = colours;
  return (
    <SaveSection
      title={COLOURS_TITLE}
      description={COLOURS_LEAD}
      blocked={colours.blocked}
      save={save}
    >
      <SelectField
        label={FONT_LABEL}
        description={sourceReading(scope, view, 'tokens.font')}
        options={FONT_OPTIONS}
        value={save.values['tokens.font'] ?? ''}
        error={save.fieldErrors['tokens.font']}
        changed={save.changed.includes('tokens.font')}
        onChange={(id) => {
          colours.setFont(id);
        }}
      />
      {SCHEMES.map((scheme) => (
        <SchemeGroup key={scheme} scheme={scheme} scope={scope} view={view} colours={colours} />
      ))}
    </SaveSection>
  );
}

// Every pair the palettes being edited are held to, as they stand on screen.
export function ContrastPanel({ report }: { report: ContrastReport }) {
  return (
    <Panel title={CONTRAST_TITLE}>
      <p className={recordTab.rule}>{CONTRAST_LEAD}</p>
      <p
        role="status"
        className={styles.summary}
        data-failing={report.failing.length > 0 || undefined}
      >
        {report.summary}
      </p>
      {report.rows.length === 0 ? null : (
        <ul className={styles.pairs}>
          {report.rows.map((row) => (
            <li key={row.id} className={styles.pair}>
              <StatusTag tone={row.passes ? 'active' : 'danger'}>
                {row.passes ? PAIR_PASSES : PAIR_FAILS}
              </StatusTag>
              <span>{rowText(row)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
