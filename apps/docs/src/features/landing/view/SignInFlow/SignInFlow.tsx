import Link from '@docusaurus/Link';
import type { ReactElement } from 'react';
import { BEATS } from '@site/src/features/landing/service/geometry';
import { claimText } from '@site/src/features/landing/service/content';
import { useSignInFlow } from '@site/src/features/landing/usecase/useSignInFlow';
import { FlowControls } from '@site/src/features/landing/view/FlowControls/FlowControls';
import { Scene } from '@site/src/features/landing/view/Scene/Scene';
import styles from '@site/src/features/landing/view/SignInFlow/SignInFlow.module.css';

// Sign-in as one scene. With no script, or with reduced motion, it is the
// composed picture and the seven captions as a list; where script runs it plays
// once when it comes into view, then loops, and the stepper lets the reader take over.
export function SignInFlow(): ReactElement {
  const { uid, stage, step, wantsPlay, live, choose, toggle, replay } = useSignInFlow();
  return (
    <div className={styles.flow} data-flow="" data-step={String(step)}>
      <div className={styles.stage} ref={stage}>
        <Scene layout="wide" step={step} uid={`${uid}-w`} />
        <Scene layout="tall" step={step} uid={`${uid}-t`} />
      </div>
      <div className={styles.below}>
        <FlowControls
          step={step}
          playing={wantsPlay}
          live={live}
          onChoose={choose}
          onToggle={toggle}
          onReplay={replay}
        />
        <ol className={styles.captions} data-flow-captions="">
          {BEATS.map((beat) => (
            <li key={beat.label}>
              <p className={styles.caption}>{beat.caption}</p>
              {beat.claims.length === 0 ? null : (
                <ul className={styles.methods}>
                  {beat.claims.map((claim) => (
                    <li key={claim} data-claim={claim}>
                      {claimText(claim)}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      </div>
      <p className={styles.more}>
        The ideas are in <Link to="/concepts/sessions/">Sessions</Link> and{' '}
        <Link to="/concepts/tokens/">Tokens</Link>, and{' '}
        <Link to="/guides/sign-a-user-in/">Sign a user in</Link> shows every request.
      </p>
    </div>
  );
}
