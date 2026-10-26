import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import StringContent from '@theme/CodeBlock/Content/String';
import ElementContent from '@theme/CodeBlock/Content/Element';
import { parseLines, TOKENS_ATTRIBUTE, WrittenLinesProvider } from '@site/src/features/code-block';

interface Props {
  children?: ReactNode;
  [TOKENS_ATTRIBUTE]?: unknown;
}

function textOf(children: ReactNode): string | undefined {
  if (children === undefined) return undefined;
  if (Children.toArray(children).some((child) => isValidElement(child))) return undefined;
  return Children.toArray(children)
    .filter((child): child is string | number => typeof child !== 'object')
    .join('');
}

// The theme's code block. It does not remount itself in the browser to apply a
// colour mode: the colours are classes, so there is nothing to apply.
export default function CodeBlock({
  children,
  [TOKENS_ATTRIBUTE]: written,
  ...rest
}: Props): ReactElement {
  const text = textOf(children);
  if (text === undefined) return <ElementContent {...rest}>{children}</ElementContent>;
  return (
    <WrittenLinesProvider value={parseLines(written)}>
      <StringContent {...rest}>{text}</StringContent>
    </WrittenLinesProvider>
  );
}
