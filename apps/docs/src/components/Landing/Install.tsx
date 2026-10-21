import useIsBrowser from '@docusaurus/useIsBrowser';
import { Fragment, useEffect, useState, type ReactElement } from 'react';
import { COMMANDS, FOLLOW_UP, type Shell } from '@site/src/components/Landing/content';
import styles from '@site/src/pages/home.module.css';

const COPIED_FOR_MS = 2000;
const TYPE_EVERY_MS = 25;

type Typing = 'off' | 'on' | 'done';

// The same breaks as the real text, with only the first `count` characters shown,
// so the line breaks are final from the first character.
function WrappedTyped({
  text,
  count,
}: {
  readonly text: string;
  readonly count: number;
}): ReactElement {
  let left = count;
  return (
    <>
      {text.split(/(?<=\/)/u).map((part, index) => {
        const shown = part.slice(0, Math.max(left, 0));
        left -= part.length;
        return (
          <Fragment key={`${part}-${String(index)}`}>
            {index > 0 ? <wbr /> : null}
            {shown}
            {shown.length < part.length ? (
              <span className={styles.rest}>{part.slice(shown.length)}</span>
            ) : null}
          </Fragment>
        );
      })}
    </>
  );
}

// A command broken after each slash, so a long address wraps at a slash.
function Wrapped({ text }: { readonly text: string }): ReactElement {
  return (
    <>
      {text.split(/(?<=\/)/u).map((part, index) => (
        <Fragment key={`${part}-${String(index)}`}>
          {index > 0 ? <wbr /> : null}
          {part}
        </Fragment>
      ))}
    </>
  );
}

type Status = 'idle' | 'copied' | 'failed';

const NOTES: Record<Status, string> = {
  idle: 'Arrives with the first release. Needs Docker with Compose v2.',
  copied: 'Copied to your clipboard.',
  failed: 'Your browser would not copy it. Select the command and copy it by hand.',
};

// The radios and their panels work with no script, through the sibling
// selectors in home.module.css; the copy button appears once React has run.
export default function Install(): ReactElement {
  const [shell, setShell] = useState<Shell>('unix');
  const [status, setStatus] = useState<Status>('idle');
  const interactive = useIsBrowser();
  const [typing, setTyping] = useState<Typing>('off');
  const [typed, setTyped] = useState(0);
  const unix = COMMANDS[0]?.command ?? '';

  // The command is real text from the first paint. Once the page is idle a
  // visual copy types over it at about 40 characters a second, then rests.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = (): void => {
      let count = 0;
      setTyping('on');
      timer = setInterval(() => {
        count += 1;
        setTyped(count);
        if (count >= unix.length) {
          clearInterval(timer);
          setTyping('done');
        }
      }, TYPE_EVERY_MS);
    };
    const wait =
      typeof requestIdleCallback === 'function'
        ? requestIdleCallback(start)
        : setTimeout(start, 400);
    return () => {
      if (typeof requestIdleCallback === 'function') cancelIdleCallback(Number(wait));
      else clearTimeout(wait);
      clearInterval(timer);
    };
  }, [unix]);

  useEffect(() => {
    if (status === 'idle') return undefined;
    const timer = setTimeout(() => {
      setStatus('idle');
    }, COPIED_FOR_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [status]);

  const copy = (): void => {
    const chosen = COMMANDS.find((entry) => entry.shell === shell);
    if (chosen === undefined) return;
    navigator.clipboard.writeText(chosen.command).then(
      () => {
        setStatus('copied');
      },
      () => {
        setStatus('failed');
      },
    );
  };

  return (
    <fieldset className={styles.install}>
      <legend className="visually-hidden">Your shell</legend>
      {COMMANDS.map((entry) => (
        <input
          key={entry.shell}
          className={[styles.shellRadio, 'visually-hidden'].join(' ')}
          type="radio"
          name="shell"
          id={`shell-${entry.shell}`}
          data-shell={entry.shell}
          checked={shell === entry.shell}
          onChange={() => {
            setShell(entry.shell);
            setStatus('idle');
            setTyping((now) => (now === 'on' ? 'done' : now));
          }}
        />
      ))}
      <div className={styles.installBar}>
        <div className={styles.shells}>
          {COMMANDS.map((entry) => (
            <label key={entry.shell} htmlFor={`shell-${entry.shell}`} data-shell={entry.shell}>
              {entry.label}
            </label>
          ))}
        </div>
        <button type="button" className={styles.copy} hidden={!interactive} onClick={copy}>
          {status === 'copied' ? 'Copied' : 'Copy'}
          <span className="visually-hidden"> the command</span>
        </button>
      </div>
      {COMMANDS.map((entry) => (
        <div key={entry.shell} className={styles.panel} data-panel={entry.shell}>
          <div className={styles.typeWrap}>
            <code data-shell={entry.shell} data-typing={entry.shell === 'unix' ? typing : 'off'}>
              <Wrapped text={entry.command} />
            </code>
            {entry.shell === 'unix' && typing === 'on' && shell === 'unix' ? (
              <span className={styles.typed} aria-hidden="true">
                <WrappedTyped text={unix} count={typed} />
              </span>
            ) : null}
          </div>
          <div className={styles.followUp} data-typing={entry.shell === 'unix' ? typing : 'off'}>
            <code className={styles.prompt}>{FOLLOW_UP.command}</code>
            {FOLLOW_UP.output.map((line) => (
              <code key={line} className={styles.output}>
                {line}
              </code>
            ))}
          </div>
        </div>
      ))}
      <p className={styles.installNote} role="status" data-install-note="">
        {NOTES[status]}
      </p>
    </fieldset>
  );
}
