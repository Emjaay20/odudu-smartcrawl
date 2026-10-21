import Link from '@docusaurus/Link';
import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import styles from '@site/src/components/Landing/flow.module.css';

interface Beat {
  readonly caption: string;
  readonly alt: string;
  readonly picture: ReactNode;
  readonly claim?: string;
}

interface Act {
  readonly id: string;
  readonly title: string;
  readonly beats: readonly Beat[];
}

function Staff({ x, y }: { readonly x: number; readonly y: number }): ReactElement {
  return (
    <g className={styles.staff} transform={`translate(${String(x)} ${String(y)})`}>
      <circle cx={0} cy={0} r={4} />
      <path d="M0 4V26M-4 8H4" />
    </g>
  );
}

function App({ x, y, w, h }: Record<'x' | 'y' | 'w' | 'h', number>): ReactElement {
  const at = (dx: number, dy: number): string => `${String(x + dx)} ${String(y + dy)}`;
  return (
    <g>
      <rect className={styles.panel} x={x} y={y} width={w} height={h} rx={6} />
      <path className={styles.line} d={`M${at(0, 11)}H${String(x + w)}`} />
      <circle className={styles.dot} cx={x + 6} cy={y + 5.5} r={1.8} />
      <path
        className={styles.line}
        d={`M${at(8, 22)}H${String(x + w - 8)}M${at(8, 30)}H${String(x + w - 20)}`}
      />
    </g>
  );
}

function Odudu({ x, y }: { readonly x: number; readonly y: number }): ReactElement {
  return (
    <>
      <rect className={styles.accent} x={x} y={y} width={48} height={50} rx={6} />
      <Staff x={x + 24} y={y + 12} />
    </>
  );
}

function Arrow({ from, to, y }: Record<'from' | 'to' | 'y', number>): ReactElement {
  const dir = to > from ? -1 : 1;
  return (
    <g className={styles.arrow}>
      <path className={styles.stroke} d={`M${String(from)} ${String(y)}H${String(to)}`} />
      <path
        className={styles.stroke}
        d={`M${String(to + dir * 5)} ${String(y - 5)}L${String(to)} ${String(y)}L${String(to + dir * 5)} ${String(y + 5)}`}
      />
    </g>
  );
}

function Pass({ x, y }: { readonly x: number; readonly y: number }): ReactElement {
  return (
    <g className={styles.badge}>
      <rect className={styles.pass} x={x} y={y} width={30} height={18} rx={9} />
      <path
        className={styles.check}
        d={`M${String(x + 10)} ${String(y + 9)}L${String(x + 14)} ${String(y + 13)}L${String(x + 21)} ${String(y + 5)}`}
      />
    </g>
  );
}

function Person({ x }: { readonly x: number }): ReactElement {
  return (
    <>
      <circle className={styles.panel} cx={x} cy={36} r={10} />
      <path className={styles.panel} d={`M${String(x - 18)} 78a18 16 0 0 1 36 0z`} />
    </>
  );
}

const SIGN_IN_TILES = [
  <g key="password" className={styles.tile} data-t="1">
    <rect className={styles.tileBox} x={32} y={26} width={30} height={30} rx={5} />
    <circle className={styles.fill} cx={41} cy={41} r={2.2} />
    <circle className={styles.fill} cx={47} cy={41} r={2.2} />
    <circle className={styles.fill} cx={53} cy={41} r={2.2} />
  </g>,
  <g key="passkey" className={styles.tile} data-t="2">
    <rect className={styles.tileBox} x={65} y={26} width={30} height={30} rx={5} />
    <circle className={styles.stroke} cx={74} cy={41} r={4} />
    <path className={styles.stroke} d="M78 41H88M85 41V45" />
  </g>,
  <g key="code" className={styles.tile} data-t="3">
    <rect className={styles.tileBox} x={98} y={26} width={30} height={30} rx={5} />
    <rect className={styles.stroke} x={107} y={32} width={12} height={18} rx={2} />
    <path className={styles.stroke} d="M111 46H115" />
  </g>,
];

const ACTS: readonly Act[] = [
  {
    id: 'first',
    title: 'The first time',
    beats: [
      {
        caption: 'A person opens your app.',
        alt: 'A person next to the window of your app.',
        picture: (
          <>
            <Person x={32} />
            <App x={70} y={18} w={78} h={60} />
          </>
        ),
      },
      {
        caption: 'Your app sends them to Odudu to sign in.',
        alt: 'An arrow from your app to Odudu, shown with its staff mark.',
        picture: (
          <>
            <App x={8} y={26} w={46} h={50} />
            <Arrow from={60} to={96} y={51} />
            <Odudu x={104} y={26} />
          </>
        ),
      },
      {
        caption:
          "They sign in on Odudu's own page. Odudu supports passwords, passkeys and codes from an authenticator app.",
        alt: 'A sign-in card offering three ways to sign in: a password, a passkey and an authenticator code.',
        picture: (
          <>
            <rect className={styles.panel} x={22} y={10} width={116} height={80} rx={6} />
            {SIGN_IN_TILES}
            <rect className={styles.accent} x={32} y={66} width={96} height={12} rx={4} />
          </>
        ),
      },
      {
        caption: 'Odudu sends them back with a signed pass, and your app lets them in.',
        alt: 'A signed pass travelling from Odudu back to your app.',
        picture: (
          <>
            <Odudu x={8} y={26} />
            <App x={108} y={26} w={46} h={50} />
            <Arrow from={62} to={100} y={63} />
            <Pass x={92} y={36} />
          </>
        ),
      },
    ],
  },
  {
    id: 'second',
    title: 'A second app',
    beats: [
      {
        caption: 'Later, they open a second app.',
        alt: 'Two app windows side by side; the second one has just appeared.',
        picture: (
          <>
            <g className={styles.dim}>
              <App x={10} y={26} w={56} h={50} />
            </g>
            <g className={styles.appear}>
              <App x={94} y={26} w={56} h={50} />
            </g>
          </>
        ),
      },
      {
        caption: 'It sends them to Odudu as well.',
        alt: 'An arrow from the second app to Odudu.',
        picture: (
          <>
            <App x={8} y={26} w={46} h={50} />
            <Arrow from={60} to={96} y={51} />
            <Odudu x={104} y={26} />
          </>
        ),
      },
      {
        caption: 'Odudu sees they are already signed in, so it shows no sign-in page.',
        alt: 'Odudu with a check mark: the person is already signed in, and no sign-in card is shown.',
        claim: 'single-sign-on',
        picture: (
          <>
            <rect className={styles.accent} x={56} y={20} width={48} height={50} rx={6} />
            <Staff x={80} y={32} />
            <g className={styles.appear}>
              <circle className={styles.pass} cx={104} cy={22} r={11} />
              <path className={styles.check} d="M98 22L102 26L110 17" />
            </g>
          </>
        ),
      },
      {
        caption:
          'Straight back, with no password asked. Sign in once, and use every app of that tenant that trusts Odudu.',
        alt: 'A signed pass travelling from Odudu to the second app.',
        claim: 'single-sign-on',
        picture: (
          <>
            <Odudu x={8} y={26} />
            <App x={108} y={26} w={46} h={50} />
            <Arrow from={62} to={100} y={63} />
            <Pass x={92} y={36} />
          </>
        ),
      },
    ],
  },
  {
    id: 'out',
    title: 'Signing out',
    beats: [
      {
        caption: 'Sign out of one, and the apps that registered for it are told.',
        alt: 'Odudu sending a notice to two apps that registered to be told when a person signs out.',
        claim: 'back-channel-logout',
        picture: (
          <>
            <Odudu x={8} y={26} />
            <Arrow from={62} to={104} y={40} />
            <Arrow from={62} to={104} y={62} />
            <App x={108} y={16} w={44} h={32} />
            <App x={108} y={54} w={44} h={32} />
          </>
        ),
      },
    ],
  },
];

const METHODS = [
  ['Password', 'passwords'],
  ['Passkey', 'passkeys'],
  ['Authenticator code', 'authenticator-codes'],
] as const;

interface ActViewProps {
  readonly act: Act;
  readonly motion: boolean;
  readonly replayed: boolean;
}

function ActView({ act, motion, replayed }: ActViewProps): ReactElement {
  const list = useRef<HTMLOListElement>(null);
  const [playing, setPlaying] = useState(replayed);

  useEffect(() => {
    const target = list.current;
    if (!motion || playing || target === null) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setPlaying(true);
        observer.disconnect();
      },
      { threshold: 0.35 },
    );
    observer.observe(target);
    return () => {
      observer.disconnect();
    };
  }, [motion, playing]);

  return (
    <div className={styles.act}>
      <h3 className={styles.actTitle}>{act.title}</h3>
      <ol
        ref={list}
        className={styles.flow}
        data-flow={act.id}
        data-armed={motion ? '' : undefined}
        data-playing={playing ? '' : undefined}
      >
        {act.beats.map((beat) => (
          <li key={beat.caption} className={styles.step} data-claim={beat.claim}>
            <svg className={styles.picture} viewBox="0 0 160 100" role="img" aria-label={beat.alt}>
              {beat.picture}
            </svg>
            <p className={styles.caption}>{beat.caption}</p>
            {beat.caption.includes('passwords, passkeys') ? (
              <ul className={styles.methods}>
                {METHODS.map(([label, claim]) => (
                  <li key={label} data-claim={claim}>
                    {label}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

// Sign-in told in pictures. With no script, or with reduced motion, every
// step is simply there; otherwise each act plays once as it scrolls into
// view and rests on its finished state, and the button plays them again.
export default function SignInFlow(): ReactElement {
  const [motion, setMotion] = useState(false);
  const [run, setRun] = useState(0);

  useEffect(() => {
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setMotion(!still && typeof IntersectionObserver !== 'undefined');
  }, []);

  return (
    <>
      <p className={styles.replayRow}>
        <button
          type="button"
          className={styles.replay}
          hidden={!motion}
          onClick={() => {
            setRun((count) => count + 1);
          }}
        >
          Replay
        </button>
      </p>
      {ACTS.map((act) => (
        <ActView key={`${act.id}-${String(run)}`} act={act} motion={motion} replayed={run > 0} />
      ))}
      <p className={styles.more}>
        The ideas are in <Link to="/concepts/sessions/">Sessions</Link> and{' '}
        <Link to="/concepts/tokens/">Tokens</Link>, and{' '}
        <Link to="/guides/sign-a-user-in/">Sign a user in</Link> shows every request.
      </p>
    </>
  );
}
