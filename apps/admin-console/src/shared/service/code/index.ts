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
