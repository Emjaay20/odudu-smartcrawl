import { Fragment, use, useId, useRef, type KeyboardEvent } from 'react';
import { TextArea, TextField as AriaTextField } from 'react-aria-components';
import {
  gutterParts,
  highlight,
  indentEdit,
  keyStep,
  lineCount,
  lineLabel,
  markedLines,
  TAB_LEAD,
  TAB_THEN,
  tokensByLine,
  type CodeLanguage,
  type CodeToken,
  type LineIssue,
  type TextEdit,
  type TokenKind,
} from '#/shared/service/code';
import {
  Description,
  FieldsReadOnly,
  Header,
  invalid,
  Message,
  VALIDATION,
  type Chrome,
} from '#/shared/view/Field';
import { KeyHint } from '#/shared/view/KeyHint';
import styles from '#/shared/view/CodeField/CodeField.module.css';

const TOKEN_CLASS: Readonly<Record<TokenKind, string | undefined>> = {
  plain: undefined,
  value: undefined,
  comment: styles.comment,
  keyword: styles.keyword,
  function: styles.keyword,
  selector: styles.selector,
  property: styles.property,
  tag: styles.property,
  string: styles.string,
  number: styles.number,
  attribute: styles.number,
  part: styles.part,
};

function Token({ token }: { token: CodeToken }) {
  const className = TOKEN_CLASS[token.kind];
  return className === undefined ? token.text : <span className={className}>{token.text}</span>;
}

// The colour drawn behind the text of the field, line by line. Every line
// ends in a break, so the last one holds its height as the field's does.
function Layer({ tokens, marked }: { tokens: readonly CodeToken[]; marked: ReadonlySet<number> }) {
  return (
    <pre className={styles.layer} aria-hidden="true">
      {tokensByLine(tokens).map((line, index) => (
        <Fragment key={index}>
          <span className={styles.line} data-marked={marked.has(index + 1) || undefined}>
            {line.map((token, at) => (
              <Token key={`${String(at)}:${token.kind}`} token={token} />
            ))}
          </span>
          {'\n'}
        </Fragment>
      ))}
    </pre>
  );
}

function Gutter({ count, marked }: { count: number; marked: readonly number[] }) {
  return (
    <div className={styles.gutter} aria-hidden="true">
      {gutterParts(count, marked).map((part, index) =>
        part.marked ? (
          <span key={`m${String(index)}`} className={styles.marked}>
            {part.text}
          </span>
        ) : (
          part.text
        ),
      )}
    </div>
  );
}

// The edit made at the selection. The browser's own undo does not see it.
function replaceRange(
  area: HTMLTextAreaElement,
  edit: TextEdit,
  onChange: (value: string) => void,
): void {
  area.setRangeText(edit.text, edit.from, edit.to, 'end');
  onChange(area.value);
  area.setSelectionRange(edit.selectionStart, edit.selectionEnd);
}

export interface CodeSize {
  text: string;
  over: boolean;
}

// A text field for code: the textarea is the control, with a coloured copy
// of its text behind it and line numbers beside it. Tab indents; Escape then
// Tab leaves. Where the server refused a line, that line carries a mark and
// the reason is listed under the field.
export function CodeField({
  label,
  description,
  error,
  changed,
  isDisabled,
  language,
  value,
  onChange,
  size,
  issues = [],
}: Chrome & {
  language: CodeLanguage;
  value: string;
  onChange: (value: string) => void;
  size?: CodeSize;
  issues?: readonly LineIssue[];
}) {
  const issuesId = useId();
  const escaped = useRef(false);
  const { tokens, plain } = highlight(language, value);
  const count = lineCount(value);
  const marks = markedLines(issues, count);

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    const step = keyStep(event, escaped.current);
    escaped.current = step.escaped;
    if (step.action === 'none') return;
    event.preventDefault();
    const area = event.currentTarget;
    const edit = indentEdit(
      area.value,
      area.selectionStart,
      area.selectionEnd,
      step.action === 'outdent',
    );
    if (edit !== null) replaceRange(area, edit, onChange);
  };

  return (
    <AriaTextField
      {...VALIDATION}
      {...invalid(error)}
      isDisabled={isDisabled ?? false}
      isReadOnly={use(FieldsReadOnly)}
      value={value}
      onChange={onChange}
      autoComplete="off"
      className={styles.field ?? ''}
      data-changed={changed === true || undefined}
      {...(issues.length === 0 ? {} : { 'aria-describedby': issuesId })}
    >
      <Header label={label} {...(changed === undefined ? {} : { changed })} />
      <div className={styles.frame} data-plain={plain || undefined}>
        <div className={styles.scroller}>
          <Gutter count={count} marked={marks} />
          <div className={styles.stage}>
            <Layer tokens={tokens} marked={new Set(marks)} />
            <TextArea
              className={styles.area ?? ''}
              data-control
              wrap="off"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              onKeyDown={onKeyDown}
              onBlur={() => {
                escaped.current = false;
              }}
            />
          </div>
        </div>
      </div>
      <Description>
        {description === undefined ? null : <>{description} </>}
        <span className={styles.hint}>
          <KeyHint lead={TAB_LEAD} keys={['Escape']} /> <KeyHint lead={TAB_THEN} keys={['Tab']} />
        </span>
        {size === undefined ? null : (
          <span className={styles.size} data-over={size.over || undefined}>
            {size.text}
          </span>
        )}
      </Description>
      {issues.length === 0 ? null : (
        <ul id={issuesId} className={styles.issues}>
          {issues.map((issue, index) => (
            <li key={`${String(issue.line)}:${String(index)}`}>{lineLabel(issue)}</li>
          ))}
        </ul>
      )}
      <Message error={error} />
    </AriaTextField>
  );
}
