import type { MailBrandingView } from '@odudu/contracts/admin';
import {
  logoViews,
  MAIL_CLIENTS_NOTE,
  MAIL_FAILED,
  MAIL_FRAME_TITLE,
  MAIL_INHERITS_LEAD,
  MAIL_LOADING_BRANDING,
  MAIL_LOCALE_LABEL,
  MAIL_LOCALE_OPTIONS,
  MAIL_PREVIEW_NOTE,
  MAIL_PREVIEW_TITLE,
  MAIL_SCHEME_LABEL,
  LOGO_TITLE,
  mailLocaleOf,
  paletteRows,
  SCHEME_OPTIONS,
  schemeTitle,
  sourceText,
  type Scheme,
} from '#/features/branding/service';
import type { MailTab as Mail } from '#/features/branding/usecase/useMailTab';
import { PreviewFrame } from '#/features/branding/view/PreviewFrame';
import { InlineFields, SelectField } from '#/shared/view/Field';
import { LoadFailed } from '#/shared/view/LoadFailed';
import { Panel } from '#/shared/view/Panel';
import { recordTab } from '#/shared/view/RecordTab';
import { FormSkeleton } from '#/shared/view/Skeleton';
import styles from '#/features/branding/view/MailTab/MailTab.module.css';

export function MailPreview({ mail }: { mail: Mail }) {
  return (
    <Panel title={MAIL_PREVIEW_TITLE}>
      <div className={styles.controls}>
        <InlineFields>
          <SelectField
            label={MAIL_SCHEME_LABEL}
            options={SCHEME_OPTIONS}
            value={mail.choice.scheme}
            onChange={(id) => {
              if (id === 'light' || id === 'dark') mail.setScheme(id);
            }}
          />
          <SelectField
            label={MAIL_LOCALE_LABEL}
            options={MAIL_LOCALE_OPTIONS}
            value={mail.choice.locale}
            onChange={(id) => {
              const locale = mailLocaleOf(id);
              if (locale !== undefined) mail.setLocale(locale);
            }}
          />
        </InlineFields>
      </div>
      <p className={styles.note}>{MAIL_PREVIEW_NOTE}</p>
      <PreviewFrame
        title={MAIL_FRAME_TITLE}
        src={mail.src}
        frameKey={mail.frameKey}
        loading={mail.loading}
        onLoaded={mail.onLoaded}
      />
    </Panel>
  );
}

function Logos({ branding }: { branding: MailBrandingView }) {
  return (
    <Panel title={LOGO_TITLE}>
      <dl className={styles.facts}>
        {logoViews(branding).map((logo) => (
          <div key={logo.label} className={styles.fact}>
            <dt>{logo.label}</dt>
            <dd>
              {logo.src === null ? (
                logo.empty
              ) : (
                <>
                  <span>{logo.alt}</span> <span className={styles.size}>{logo.size}</span>
                  <code className={styles.address}>{logo.src}</code>
                </>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

function Palette({ scheme, view }: { scheme: Scheme; view: MailBrandingView['light'] }) {
  return (
    <Panel title={schemeTitle(scheme)}>
      <p className={recordTab.rule}>{sourceText(view.source)}</p>
      <table className={styles.table}>
        <caption className={styles.caption}>{schemeTitle(scheme)}</caption>
        <thead>
          <tr>
            <th scope="col">Colour</th>
            <th scope="col">Value</th>
            <th scope="col">Used for</th>
          </tr>
        </thead>
        <tbody>
          {paletteRows(view.colours).map((row) => (
            <tr key={row.role}>
              <th scope="row">{row.label}</th>
              <td>
                <span
                  className={styles.swatch}
                  style={{ backgroundColor: row.colour }}
                  aria-hidden="true"
                />
                <code>{row.colour}</code>
              </td>
              <td>{row.used}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

export function MailInherits({ mail }: { mail: Mail }) {
  const { branding } = mail;
  if (branding.status === 'loading') {
    return <FormSkeleton label={MAIL_LOADING_BRANDING} fields={3} />;
  }
  if (branding.status === 'failed') {
    return <LoadFailed title={MAIL_FAILED} retry={branding.retry} />;
  }
  return (
    <div className={styles.inherits}>
      <p className={recordTab.rule}>{MAIL_INHERITS_LEAD}</p>
      <p className={recordTab.rule}>{MAIL_CLIENTS_NOTE}</p>
      <Logos branding={branding.data} />
      <Palette scheme="light" view={branding.data.light} />
      <Palette scheme="dark" view={branding.data.dark} />
    </div>
  );
}
