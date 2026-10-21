import { DocsLink } from '@site/src/shared/view/DocsLink/DocsLink';
import type { ReactElement } from 'react';
import { captions } from '@site/src/features/landing/service/playback';
import { useSignInFlow } from '@site/src/features/landing/usecase/useSignInFlow';
import { FlowControls } from '@site/src/features/landing/view/FlowControls/FlowControls';
import { Scene } from '@site/src/features/landing/view/Scene/Scene';
import styles from '@site/src/features/landing/view/SignInFlow/SignInFlow.module.css';

// Sign-in as one scene. With no script, or with reduced motion, it is the
// composed picture and the seven captions as a list; where script runs it plays
// once when it comes into view, then loops, and the stepper lets the reader take over.
export function SignInFlow(): ReactElement {
  const { uid, stage, step, wantsPlay, label, live, politeness, buttons, choose, toggle, replay } =
    useSignInFlow();
  return (
    <div className={styles.flow} data-flow="" data-step={String(step)}>
      <div className={styles.stage} ref={stage}>
        <Scene layout="wide" step={step} uid={`${uid}-w`} />
        <Scene layout="tall" step={step} uid={`${uid}-t`} />
      </div>
      <div className={styles.below}>
        <FlowControls
          buttons={buttons}
          playing={wantsPlay}
          label={label}
          live={live}
          politeness={politeness}
          onChoose={choose}
          onToggle={toggle}
          onReplay={replay}
        />
        <ol className={styles.captions} data-flow-captions="">
          {captions().map((item) => (
            <li key={item.label}>
              <p className={styles.caption}>{item.caption}</p>
              {item.hasClaims ? (
                <ul className={styles.methods}>
                  {item.claims.map((claim) => (
                    <li key={claim.id} data-claim={claim.id}>
                      {claim.text}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
      <p className={styles.more}>
        The ideas are in <DocsLink to="/concepts/sessions/">Sessions</DocsLink> and{' '}
        <DocsLink to="/concepts/tokens/">Tokens</DocsLink>, and{' '}
        <DocsLink to="/guides/sign-a-user-in/">Sign a user in</DocsLink> shows every request.
      </p>
    </div>
  );
}
