import { DocsLink } from '@site/src/shared/view/DocsLink/DocsLink';
import type { ReactElement } from 'react';
import { BRANDING, PLANNED_LABEL, ROADMAP_NEXT } from '@site/src/features/landing/service/content';
import { useBrandingPictures } from '@site/src/features/landing/usecase/useBrandingPictures';
import { Chip } from '@site/src/features/landing/view/Chip/Chip';
import { Frame } from '@site/src/features/landing/view/Frame/Frame';
import { Section } from '@site/src/features/landing/view/Section/Section';
import styles from '@site/src/features/landing/view/Branding/Branding.module.css';

const LOOKS = { odudu: styles.odudu, other: styles.other };
const SCHEMES = { light: styles.light, dark: styles.dark };
const LEGEND = 'Illustration of a planned feature: the same sign-in page in two looks';

export function Branding(): ReactElement {
  const pictures = useBrandingPictures();
  const picture = (
    <figure className={styles.figure}>
      <Frame kind="look">
        {pictures.map((item) => (
          <img
            key={item.src}
            className={[styles.picture, LOOKS[item.look], SCHEMES[item.scheme]].join(' ')}
            src={item.src}
            alt={item.alt}
            width={item.width}
            height={item.height}
            loading="lazy"
          />
        ))}
      </Frame>
      <figcaption className={styles.caption}>{BRANDING.caption}</figcaption>
    </figure>
  );
  return (
    <Section
      id="home-branding"
      kicker="Make it yours"
      title={BRANDING.title}
      section="branding"
      tone="sunken"
      aside={picture}
    >
      <div data-planned={BRANDING.id}>
        <p className={styles.status}>
          <Chip>{PLANNED_LABEL}</Chip>
        </p>
        <p className={styles.body}>
          {BRANDING.claim} <DocsLink to={ROADMAP_NEXT}>On the roadmap</DocsLink>
        </p>
        <p className={styles.body} data-today="">
          {BRANDING.today}
        </p>
      </div>
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
    </Section>
  );
}
