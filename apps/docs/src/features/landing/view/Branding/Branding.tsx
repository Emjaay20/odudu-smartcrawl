import { DocsLink } from '@site/src/shared/view/DocsLink/DocsLink';
import type { ReactElement } from 'react';
import { BRANDING, PLANNED_LABEL, ROADMAP_NEXT } from '@site/src/features/landing/service/content';
import { useBrandingPictures } from '@site/src/features/landing/usecase/useBrandingPictures';
import { Chip } from '@site/src/features/landing/view/Chip/Chip';
import styles from '@site/src/features/landing/view/Branding/Branding.module.css';

const LOOKS = { odudu: styles.odudu, other: styles.other };
const SCHEMES = { light: styles.light, dark: styles.dark };
const LEGEND = 'Illustration of a planned feature: the same sign-in page in two looks';

export function Branding(): ReactElement {
  const pictures = useBrandingPictures();
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
              className={[styles.picture, LOOKS[picture.look], SCHEMES[picture.scheme]].join(' ')}
              src={picture.src}
              alt={picture.alt}
              width={picture.width}
              height={picture.height}
              loading="lazy"
            />
          ))}
          <figcaption className={styles.caption}>{BRANDING.caption}</figcaption>
        </figure>
      </div>
    </div>
  );
}
