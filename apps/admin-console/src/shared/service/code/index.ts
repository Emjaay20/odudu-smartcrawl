export {
  highlight,
  lineCount,
  normalisedBreaks,
  tokensByLine,
} from '#/shared/service/code/highlight';
export {
  gutterParts,
  lineLabel,
  markedLines,
  type GutterPart,
  type LineIssue,
} from '#/shared/service/code/gutter';
export {
  historyKey,
  indentEdit,
  INDENT,
  keyStep,
  TAB_LEAD,
  TAB_THEN,
  type KeyPress,
  type KeyStep,
  type TextEdit,
} from '#/shared/service/code/editing';
export {
  HIGHLIGHT_LIMIT,
  PLAIN_NOTE,
  type CodeLanguage,
  type CodeToken,
  type Highlighted,
  type TokenKind,
} from '#/shared/service/code/tokens';
export { cssTokens } from '#/shared/service/code/css';
export { templateTokens, MARKER_LIMIT } from '#/shared/service/code/template';
export {
  DISCRETE,
  EMPTY_HISTORY,
  HISTORY_MAX_CHARS,
  HISTORY_MAX_ENTRIES,
  HISTORY_PAUSE_MS,
  inputIntent,
  noted,
  reconciled,
  recorded,
  redone,
  snapshotOf,
  travelled,
  undone,
  type EditKind,
  type History,
  type HistoryEdit,
  type InputIntent,
  type Snapshot,
  type Stepped,
  type Travel,
} from '#/shared/service/code/history';
