import useIsBrowser from '@docusaurus/useIsBrowser';
import { Fragment, useEffect, useState, type ReactElement } from 'react';
import { COMMANDS, type Shell } from '@site/src/components/Landing/content';
import styles from '@site/src/pages/home.module.css';

const COPIED_FOR_MS = 2000;

type Status = 'idle' | 'copied' | 'failed';

const NOTES: Record<Status, string> = {
  idle: 'Needs Docker with Compose v2. About ten minutes to your first sign-in.',
  copied: 'Copied to your clipboard.',
  failed: 'Your browser would not copy it. Select the command and copy it by hand.',
};

// The radios and their panels work with no script, through the sibling
// selectors in home.module.css; the copy button appears once React has run.
export default function Install(): ReactElement {
  const [shell, setShell] = useState<Shell>('unix');
  const [status, setStatus] = useState<Status>('idle');
  const interactive = useIsBrowser();

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
          <code data-shell={entry.shell}>
            {entry.command.split(/(?<=\/)/u).map((part, index) => (
              <Fragment key={`${part}-${String(index)}`}>
                {index > 0 ? <wbr /> : null}
                {part}
              </Fragment>
            ))}
          </code>
        </div>
      ))}
      <p className={styles.installNote} role="status">
        {NOTES[status]}
      </p>
    </fieldset>
  );
}
