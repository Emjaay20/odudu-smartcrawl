import { Fragment, type ReactElement } from 'react';
import { COMMANDS, FOLLOW_UP } from '@site/src/features/landing/service/content';
import {
  copyLabel,
  lineVisible,
  noteFor,
  overlayShown,
  segments,
  typedSegments,
} from '@site/src/features/landing/service/terminal';
import { useInstall } from '@site/src/features/landing/usecase/useInstall';
import styles from '@site/src/features/landing/view/Install/Install.module.css';

// A command broken after each slash, so a long address wraps at a slash.
function Wrapped({ text }: { readonly text: string }): ReactElement {
  return (
    <>
      {segments(text).map((part, index) => (
        <Fragment key={`${part}-${String(index)}`}>
          {index > 0 ? <wbr /> : null}
          {part}
        </Fragment>
      ))}
    </>
  );
}

// The same breaks as the real text, with only the first `count` characters shown.
function WrappedTyped({
  text,
  count,
}: {
  readonly text: string;
  readonly count: number;
}): ReactElement {
  return (
    <>
      {typedSegments(text, count).map(({ shown, hidden }, index) => (
        <Fragment key={`${shown}${hidden}-${String(index)}`}>
          {index > 0 ? <wbr /> : null}
          {shown}
          {hidden === '' ? null : <span className={styles.rest}>{hidden}</span>}
        </Fragment>
      ))}
    </>
  );
}

// The radios and their panels work with no script, through the sibling
// selectors in Install.module.css; the copy button appears once React has run.
export function Install(): ReactElement {
  const { shell, status, typing, typed, lines, interactive, choose, copy } = useInstall();
  const unix = COMMANDS[0]?.command ?? '';
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
            choose(entry.shell);
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
          {copyLabel(status)}
          <span className="visually-hidden"> the command</span>
        </button>
      </div>
      {COMMANDS.map((entry) => (
        <div key={entry.shell} className={styles.panel} data-panel={entry.shell}>
          <div className={styles.typeWrap}>
            <code data-shell={entry.shell} data-typing={entry.shell === 'unix' ? typing : 'off'}>
              <Wrapped text={entry.command} />
            </code>
            {overlayShown(entry.shell, shell, typing) ? (
              <span className={styles.typed} aria-hidden="true">
                <WrappedTyped text={unix} count={typed} />
              </span>
            ) : null}
          </div>
          <div className={styles.followUp}>
            {[FOLLOW_UP.command, ...FOLLOW_UP.output].map((line, index) => (
              <code
                key={line}
                className={index === 0 ? undefined : styles.output}
                data-visible={String(lineVisible(entry.shell, typing, lines, index))}
              >
                {line}
              </code>
            ))}
          </div>
        </div>
      ))}
      <p className={styles.installNote} role="status" data-install-note="">
        {noteFor(status)}
      </p>
    </fieldset>
  );
}
