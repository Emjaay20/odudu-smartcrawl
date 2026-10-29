import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { MAX_STYLESHEET_BYTES } from '@odudu/contracts';
import { axeInBothThemes } from '#/testing/axeInBothThemes';
import {
  brandingRoutes,
  draftedView,
  EMPTY,
  OWN_LIGHT,
  TH,
  themeAnswer,
  themeView,
} from '#/testing/brandingFixtures';
import { inTurn, json, problem } from '#/testing/fakeTransport';
import { consoleAt, renderConsoleAt } from '#/testing/renderConsole';
import { resetConsole } from '#/testing/resetConsole';

afterEach(() => {
  resetConsole();
  sessionStorage.clear();
});

const AT = '/console/acme/branding';

const section = () => screen.findByRole('region', { name: 'Stylesheet' });
const box = (within_: HTMLElement) =>
  within(within_).getByRole('textbox', { name: 'Stylesheet CSS' });

function withStylesheet(css: string) {
  return themeView({
    draft: { ...EMPTY, tokens: { light: OWN_LIGHT }, stylesheet: css },
    draft_sources: { stylesheet: 'tenant' },
  });
}

describe('the stylesheet editor', () => {
  it('sits in the Theme tab, says where its stylesheet comes from, and that a change shows after saving', async () => {
    renderConsoleAt(AT, brandingRoutes(themeAnswer(draftedView(), '"d1"')));
    const editor = await section();
    expect(within(editor).getByText(/Draft: Instrument’s default · Published:/u)).toBeVisible();
    expect(within(editor).getByText(/save to see a change/u)).toBeVisible();
    expect(box(editor)).toHaveValue('');
    expect(
      within(editor).getByText(`0 of ${MAX_STYLESHEET_BYTES.toLocaleString('en')} bytes.`),
    ).toBeVisible();
  });

  it('shows the saved stylesheet, coloured, with line numbers', async () => {
    renderConsoleAt(
      AT,
      brandingRoutes(themeAnswer(withStylesheet('.logo {\n  opacity: 0.5;\n}'), '"d1"')),
    );
    const editor = await section();
    expect(box(editor)).toHaveValue('.logo {\n  opacity: 0.5;\n}');
    expect(editor.querySelector('div[aria-hidden="true"]')?.textContent).toBe('1\n2\n3');
  });

  it('saves on the draft’s tag with the rest of the draft carried, and an empty one as none', async () => {
    const user = userEvent.setup();
    const { sent } = renderConsoleAt(
      AT,
      brandingRoutes(themeAnswer(draftedView(), '"d1"'), {
        [`PUT ${TH}`]: json(withStylesheet('.logo { opacity: 0.5 }'), 200, { etag: '"d2"' }),
      }),
    );
    const editor = await section();
    await user.click(box(editor));
    await user.paste('.logo { opacity: 0.5 }');
    expect(within(editor).getByText('Changed')).toBeVisible();
    await user.click(within(editor).getByRole('button', { name: /Save/u }));
    await waitFor(() => {
      expect(sent.some((s) => s.method === 'PUT')).toBe(true);
    });
    const put = sent.find((s) => s.method === 'PUT');
    expect(put?.ifMatch).toBe('"d1"');
    expect(put?.body).toMatchObject({
      stylesheet: '.logo { opacity: 0.5 }',
      tokens: { light: { surfacePage: '#ffffff' } },
      assets: { logo: { alt: 'Acme' } },
    });
  });

  it('holds publishing until it is saved, naming the section', async () => {
    const user = userEvent.setup();
    renderConsoleAt(AT, brandingRoutes(themeAnswer(draftedView(), '"d1"')));
    const editor = await section();
    await user.click(box(editor));
    await user.paste('a {}');
    expect(await screen.findByText(/Save your changes first, in Stylesheet:/u)).toBeVisible();
    expect(screen.getByRole('tab', { name: /Theme/u })).toHaveTextContent(/unsaved|●|•|changes/iu);
  });

  describe('a refusal', () => {
    const refusal = {
      errors: [
        {
          path: 'stylesheet',
          message: 'The property is not allowed.',
          code: 'property-not-allowed',
          detail: 'behavior',
          line: 2,
          column: 3,
        },
        {
          path: 'stylesheet',
          message: 'The stylesheet is larger than the limit.',
          code: 'too-many-rules',
          line: null,
          column: null,
        },
      ],
    };

    async function refused() {
      const user = userEvent.setup();
      renderConsoleAt(
        AT,
        brandingRoutes(themeAnswer(draftedView(), '"d1"'), {
          [`PUT ${TH}`]: problem(400, 'about:blank', 'Bad Request', refusal),
        }),
      );
      const editor = await section();
      await user.click(box(editor));
      await user.paste('.logo {\n  behavior: x;\n}');
      await user.click(within(editor).getByRole('button', { name: /Save/u }));
      await within(editor).findByText(/The stylesheet was not saved\./u);
      return { user, editor };
    }

    it('marks the line the server named, and words it in the console’s own words', async () => {
      const { editor } = await refused();
      expect(
        within(editor).getByText('Line 2: This property is not allowed. (behavior)'),
      ).toBeVisible();
      expect(box(editor)).toHaveAccessibleDescription(/Line 2: This property is not allowed\./u);
      const marked = editor.querySelectorAll('div[aria-hidden="true"] > span');
      expect(marked).toHaveLength(1);
      expect(marked[0]).toHaveTextContent('2');
      expect(editor.querySelector('[data-marked]')).not.toBeNull();
    });

    it('says one that names no line under the editor', async () => {
      const { editor } = await refused();
      expect(
        within(editor).getByText(/The stylesheet has more rules than the limit\./u),
      ).toBeVisible();
      expect(box(editor)).toBeInvalid();
    });

    it('lets go of the marks once the text is edited', async () => {
      const { user, editor } = await refused();
      await user.type(box(editor), 'x');
      expect(within(editor).queryByText(/Line 2:/u)).toBeNull();
      expect(editor.querySelector('[data-marked]')).toBeNull();
    });
  });

  it('holds Save while it is over the limit, and says by how much', async () => {
    const user = userEvent.setup();
    renderConsoleAt(AT, brandingRoutes(themeAnswer(draftedView(), '"d1"')));
    const editor = await section();
    await user.click(box(editor));
    await user.paste('x'.repeat(MAX_STYLESHEET_BYTES + 10));
    expect(within(editor).getByText(/10 bytes over the limit of/u)).toBeVisible();
    expect(within(editor).getByRole('button', { name: /Save/u })).toBeDisabled();
  });

  it('a 412 offers keep mine or take theirs', async () => {
    const user = userEvent.setup();
    renderConsoleAt(
      AT,
      brandingRoutes(
        inTurn(
          themeAnswer(draftedView(), '"d1"'),
          themeAnswer(withStylesheet('.logo { opacity: 0.1 }'), '"d2"'),
        ),
        { [`PUT ${TH}`]: problem(412, 'about:blank', 'Precondition Failed') },
      ),
    );
    const editor = await section();
    await user.click(box(editor));
    await user.paste('.logo { opacity: 0.5 }');
    await user.click(within(editor).getByRole('button', { name: /Save/u }));
    expect(await within(editor).findByRole('button', { name: /Keep mine/u })).toBeVisible();
    expect(within(editor).getByRole('button', { name: /Take theirs/u })).toBeVisible();
  });

  it('has nothing axe can find in either theme, with a line marked', async () => {
    const { element } = consoleAt(
      AT,
      brandingRoutes(themeAnswer(withStylesheet('.logo {\n  opacity: 0.5;\n}'), '"d1"')),
    );
    const found = await axeInBothThemes(
      () => element,
      () => screen.findByRole('region', { name: 'Stylesheet' }),
      { frames: false },
    );
    expect(found).toEqual({ light: [], dark: [] });
  });
});
