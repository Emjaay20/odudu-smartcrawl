import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { HIGHLIGHT_LIMIT, type CodeLanguage, type LineIssue } from '#/shared/service/code';
import { CodeField } from '#/shared/view/CodeField/CodeField';
import css from '#/shared/view/CodeField/CodeField.module.css?raw';
import { ReadOnlyFields } from '#/shared/view/Field';
import { axeInBothThemes } from '#/testing/axeInBothThemes';

function Editor({
  start = '',
  language = 'css',
  issues,
  size,
  onValue,
}: {
  start?: string;
  language?: CodeLanguage;
  issues?: readonly LineIssue[];
  size?: { text: string; over: boolean };
  onValue?: (value: string) => void;
}) {
  const [value, setValue] = useState(start);
  return (
    <>
      <CodeField
        label="Stylesheet"
        description="Your own rules."
        language={language}
        value={value}
        onChange={(next) => {
          setValue(next);
          onValue?.(next);
        }}
        {...(issues === undefined ? {} : { issues })}
        {...(size === undefined ? {} : { size })}
      />
      <button type="button">After</button>
    </>
  );
}

const box = () => screen.getByRole('textbox', { name: 'Stylesheet' });

function layer(container: HTMLElement): HTMLElement {
  const found = container.querySelector('pre[aria-hidden="true"]');
  if (!(found instanceof HTMLElement)) throw new Error('no layer');
  return found;
}

describe('CodeField', () => {
  it('is a labelled textarea that reports what is typed', async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<Editor onValue={onValue} />);
    await user.type(box(), 'a');
    expect(box().tagName).toBe('TEXTAREA');
    expect(onValue).toHaveBeenCalledWith('a');
    expect(box()).toHaveAttribute('wrap', 'off');
  });

  it('draws a coloured copy of the text behind it, hidden from assistive technology', () => {
    const { container } = render(<Editor start={'.a { color: red }\n/* x */'} />);
    const copy = layer(container);
    expect(copy.textContent).toBe('.a { color: red }\n/* x */\n');
    expect(copy.querySelectorAll('span span').length).toBeGreaterThan(2);
    expect(box()).toHaveValue('.a { color: red }\n/* x */');
  });

  it('colours a template with its parts', () => {
    const { container } = render(<Editor language="template" start="<p>{{intro}}</p>" />);
    expect(layer(container).textContent).toBe('<p>{{intro}}</p>\n');
    expect(within(layer(container)).getByText('{{intro}}')).toBeInTheDocument();
  });

  it('numbers the lines, as the text grows', async () => {
    const user = userEvent.setup();
    const { container } = render(<Editor start={'a\nb'} />);
    const gutter = () => container.querySelector('div[aria-hidden="true"]')?.textContent;
    expect(gutter()).toBe('1\n2');
    await user.type(box(), '{Enter}c');
    expect(gutter()).toBe('1\n2\n3');
  });

  it('puts no inline style on anything, as the console policy has no unsafe-inline', () => {
    const { container } = render(
      <Editor start={'a { color: red }'} issues={[{ line: 1, text: 'Not allowed.' }]} />,
    );
    expect(container.querySelector('[style]')).toBeNull();
  });

  it('keeps the layer and the textarea on one set of metrics', () => {
    const source = css.replace(/\/\*[\s\S]*?\*\//gu, '');
    const shared = /\.layer,\s*\.area\s*\{([^}]*)\}/u.exec(source)?.[1] ?? '';
    for (const property of ['grid-area', 'padding', 'border', 'font', 'white-space', 'tab-size']) {
      expect(shared).toContain(`${property}:`);
    }
    expect(source).not.toMatch(/style=|unsafe-inline/u);
  });

  describe('Tab', () => {
    it('indents, and lets go after Escape', async () => {
      const user = userEvent.setup();
      render(<Editor start="a" />);
      await user.click(box());
      await user.keyboard('{Tab}');
      expect(box()).toHaveValue('a  ');
      expect(box()).toHaveFocus();
      await user.keyboard('{Escape}{Tab}');
      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
    });

    it('lets go backwards with Escape then Shift+Tab, and only once', async () => {
      const user = userEvent.setup();
      render(<Editor start="" />);
      await user.click(box());
      await user.keyboard('{Escape}{Shift>}{Tab}{/Shift}');
      expect(box()).not.toHaveFocus();
      await user.click(box());
      await user.keyboard('{Tab}');
      expect(box()).toHaveFocus();
      expect(box()).toHaveValue('  ');
    });

    it('indents each line of a selection and Shift+Tab takes it back', async () => {
      const user = userEvent.setup();
      render(<Editor start={'a\nb'} />);
      await user.click(box());
      await user.keyboard('{Control>}a{/Control}{Tab}');
      expect(box()).toHaveValue('  a\n  b');
      await user.keyboard('{Shift>}{Tab}{/Shift}');
      expect(box()).toHaveValue('a\nb');
    });

    it('says how to leave, where the field is described', () => {
      render(<Editor />);
      expect(box()).toHaveAccessibleDescription(
        /Your own rules\..*Tab indents\. To move on, press Escape then Tab/u,
      );
    });
  });

  describe('a refused line', () => {
    const issues = [
      { line: 2, text: 'The property is not allowed.' },
      { line: 9, text: 'Past the end.' },
    ];

    it('is marked in the gutter and listed, linked to the field', () => {
      const { container } = render(<Editor start={'a {\n  x: 1\n}'} issues={issues} />);
      const marked = container.querySelectorAll('div[aria-hidden="true"] > span');
      expect(marked).toHaveLength(1);
      expect(marked[0]).toHaveTextContent('2');
      expect(screen.getByText('Line 2: The property is not allowed.')).toBeInTheDocument();
      expect(box()).toHaveAccessibleDescription(/Line 2: The property is not allowed\./u);
    });

    it('tints the line in the layer', () => {
      const { container } = render(<Editor start={'a {\n  x: 1\n}'} issues={issues} />);
      const lines = layer(container).children;
      expect(lines[1]).toHaveAttribute('data-marked', 'true');
      expect(lines[0]).not.toHaveAttribute('data-marked');
    });
  });

  it('counts against a limit and says when it is over', () => {
    render(<Editor size={{ text: '3 bytes over the limit of 2 bytes.', over: true }} />);
    expect(screen.getByText('3 bytes over the limit of 2 bytes.')).toHaveAttribute(
      'data-over',
      'true',
    );
  });

  it('shows text too long to colour as typed', () => {
    const long = 'x'.repeat(HIGHLIGHT_LIMIT + 1);
    const { container } = render(<Editor start={long} />);
    expect(container.querySelector('[data-plain]')).not.toBeNull();
    expect(layer(container).querySelectorAll('span span')).toHaveLength(0);
    expect(box()).toHaveValue(long);
  });

  it('is read-only where the page is', () => {
    render(
      <ReadOnlyFields when>
        <CodeField label="Stylesheet" language="css" value="a {}" onChange={vi.fn()} />
      </ReadOnlyFields>,
    );
    expect(box()).toHaveAttribute('readonly');
    expect(box()).toHaveValue('a {}');
  });

  it('shows an error under the field', () => {
    render(
      <CodeField
        label="Stylesheet"
        language="css"
        value="a"
        error="The stylesheet was not saved."
        onChange={vi.fn()}
      />,
    );
    expect(box()).toBeInvalid();
    expect(box()).toHaveAccessibleDescription(/The stylesheet was not saved\./u);
  });

  it('passes axe in both themes, with a refused line', async () => {
    expect(
      await axeInBothThemes(() => (
        <Editor
          start={'a {\n  x: 1\n}'}
          issues={[{ line: 2, text: 'The property is not allowed.' }]}
          size={{ text: '12 of 131,072 bytes.', over: false }}
        />
      )),
    ).toEqual({ light: [], dark: [] });
  });
});
