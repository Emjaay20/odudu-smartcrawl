import { DocsLink } from '@site/src/shared/view/DocsLink/DocsLink';
import type { ReactElement } from 'react';
import { BRANDING, PLANNED_LABEL, ROADMAP_NEXT } from '@site/src/features/landing/service/content';
import { usePageShot } from '@site/src/features/landing/usecase/usePageShot';
import { Chip } from '@site/src/features/landing/view/Chip/Chip';
import styles from '@site/src/features/landing/view/Branding/Branding.module.css';

const ODUDU_ALT = "The sign-in page in Odudu's own colours.";
const OTHER_ALT = "The same sign-in page in another brand's purple colours.";
const LEGEND = 'Illustration of a planned feature: the same sign-in page in two looks';

export function Branding(): ReactElement {
  const odudu = usePageShot('sign-in');
  const other = usePageShot('sign-in-branded');
  const pictures = [
    { ...odudu, look: styles.odudu, alt: ODUDU_ALT },
    { ...other, look: styles.other, alt: OTHER_ALT },
  ].flatMap(({ look, alt, light, dark, size }) =>
    [
      { scheme: styles.light, src: light },
      { scheme: styles.dark, src: dark },
    ].map(({ scheme, src }) => ({
      className: [styles.picture, look, scheme].join(' '),
      src,
      alt,
      ...size,
    })),
  );
  return (
    <div className={styles.branding} data-planned={BRANDING.id} data-reveal="">
      <h3 className={styles.title}>
        {BRANDING.title}
        <Chip>{PLANNED_LABEL}</Chip>
      </h3>
      <p className={styles.body}>
        {BRANDING.claim} <DocsLink to={ROADMAP_NEXT}>On the roadmap</DocsLink>
      </p>
      <p className={styles.body} data-today="">
        {BRANDING.today}
      </p>
      <div className={styles.stage}>
        <fieldset className={styles.looks}>
          <legend className={styles.legend}>{LEGEND}</legend>
          <label className={styles.look}>
            <input
              className={styles.pickOdudu}
              type="radio"
              name="branding-look"
              value="odudu"
              defaultChecked
            />{' '}
            Odudu look
          </label>
          <label className={styles.look}>
            <input className={styles.pickOther} type="radio" name="branding-look" value="other" />{' '}
            Another brand&apos;s colours
          </label>
        </fieldset>
        <figure className={styles.frame}>
          {pictures.map((picture) => (
            <img
              key={picture.src}
              className={picture.className}
              src={picture.src}
              alt={picture.alt}
              width={picture.width}
              height={picture.height}
              loading="lazy"
            />
          ))}
          <figcaption className={styles.caption}>{BRANDING.illustration}</figcaption>
        </figure>
      </div>
    </div>
  );
}
