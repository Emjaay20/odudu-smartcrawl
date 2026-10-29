import {
  PAGE_KIND_OPTIONS,
  PREVIEW_FRAME_TITLE,
  PREVIEW_KIND_LABEL,
  PREVIEW_NOTE,
  PREVIEW_SCHEME_LABEL,
  PREVIEW_TITLE,
  SCHEME_OPTIONS,
  pageKindOf,
} from '#/features/branding/service';
import type { Preview } from '#/features/branding/usecase/usePreview';
import { PreviewFrame } from '#/features/branding/view/PreviewFrame';
import { InlineFields, SelectField } from '#/shared/view/Field';
import { Note } from '#/shared/view/Note';
import { Panel } from '#/shared/view/Panel';
import styles from '#/features/branding/view/PreviewPane/PreviewPane.module.css';

// The real page for the saved draft, in a frame that may run nothing and
// shares no origin with the console.
export function PreviewPane({ preview, pickKind }: { preview: Preview; pickKind: boolean }) {
  return (
    <Panel title={PREVIEW_TITLE}>
      <div className={styles.controls}>
        <InlineFields>
          {pickKind ? (
            <SelectField
              label={PREVIEW_KIND_LABEL}
              options={PAGE_KIND_OPTIONS}
              value={preview.choice.kind}
              onChange={(id) => {
                const kind = pageKindOf(id);
                if (kind !== undefined) preview.setKind(kind);
              }}
            />
          ) : null}
          <SelectField
            label={PREVIEW_SCHEME_LABEL}
            options={SCHEME_OPTIONS}
            value={preview.choice.scheme}
            onChange={(id) => {
              if (id === 'light' || id === 'dark') preview.setScheme(id);
            }}
          />
        </InlineFields>
      </div>
      <p className={styles.note}>{PREVIEW_NOTE}</p>
      {preview.note === null ? null : <Note>{preview.note}</Note>}
      <PreviewFrame
        title={PREVIEW_FRAME_TITLE}
        src={preview.src}
        frameKey={preview.frameKey}
        loading={preview.loading}
        onLoaded={preview.onLoaded}
      />
    </Panel>
  );
}
