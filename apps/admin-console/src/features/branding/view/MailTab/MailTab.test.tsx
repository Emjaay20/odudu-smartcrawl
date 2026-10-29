import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';
import { axeInBothThemes } from '#/testing/axeInBothThemes';
import { languagesRoutes, ML, mailBranding } from '#/testing/brandingFixtures';
import { json, problem } from '#/testing/fakeTransport';
import { consoleAt, renderConsoleAt } from '#/testing/renderConsole';
import { resetConsole } from '#/testing/resetConsole';

afterEach(() => {
  resetConsole();
  sessionStorage.clear();
});

const AT = '/console/acme/branding?tab=mail';

it('frames the production mail with no script and no shared origin', async () => {
  renderConsoleAt(AT, languagesRoutes());
  const frame = await screen.findByTitle('Preview of the verification mail');
  expect(frame).toHaveAttribute('sandbox', '');
  expect(frame).toHaveAttribute('referrerpolicy', 'no-referrer');
  const src = frame.getAttribute('src') ?? '';
  expect(src).toContain('/admin/tenants/acme/mail/preview?');
  expect(new URL(src, 'http://x').searchParams.get('scheme')).toBe('light');
  expect(new URL(src, 'http://x').searchParams.get('locale')).toBeNull();
});

it('asks for the dark scheme and a language when they are chosen', async () => {
  const user = userEvent.setup();
  renderConsoleAt(AT, languagesRoutes());
  await screen.findByTitle('Preview of the verification mail');
  await user.click(screen.getByRole('button', { name: /Colour scheme/u }));
  await user.click(await screen.findByRole('option', { name: 'Dark' }));
  await user.click(screen.getByRole('button', { name: /Language/u }));
  await user.click(await screen.findByRole('option', { name: /Arabic/u }));
  const params = new URL(
    (await screen.findByTitle('Preview of the verification mail')).getAttribute('src') ?? '',
    'http://x',
  ).searchParams;
  expect(params.get('scheme')).toBe('dark');
  expect(params.get('locale')).toBe('ar');
});

it('lists the nine colours of each scheme and who supplies each palette', async () => {
  renderConsoleAt(AT, languagesRoutes());
  const light = await screen.findByRole('region', { name: 'Light colours' });
  expect(within(light).getAllByRole('row')).toHaveLength(10);
  expect(within(light).getByText('From the tenant’s published theme.')).toBeVisible();
  expect(within(light).getByRole('row', { name: /Message background/u })).toHaveTextContent(
    '#fafafa',
  );
  const dark = screen.getByRole('region', { name: 'Dark colours' });
  expect(within(dark).getByText('Odudu’s default.')).toBeVisible();
});

it('shows the logo the mail carries, and says when there is none', async () => {
  renderConsoleAt(AT, languagesRoutes());
  const logo = await screen.findByRole('region', { name: 'Logo' });
  expect(logo).toHaveTextContent('Acme logo');
  expect(logo).toHaveTextContent('160 by 32 pixels');
  expect(logo).toHaveTextContent('light logo is shown in both schemes');
});

it('says the mail keeps Odudu’s own mark when the theme sets no logo', async () => {
  renderConsoleAt(AT, languagesRoutes({ [`GET ${ML}`]: json(mailBranding({ logo: null })) }));
  expect(await screen.findByText(/shows Odudu’s own mark/u)).toBeVisible();
});

it('says the colours could not be loaded, and offers to try again', async () => {
  renderConsoleAt(AT, languagesRoutes({ [`GET ${ML}`]: problem(500, 'about:blank', 'Error') }));
  expect(await screen.findByText('The colours and logo could not be loaded.')).toBeVisible();
  expect(screen.getByRole('button', { name: /Try again|Retry/u })).toBeVisible();
});

it('heads what the mail inherits, beside the logo and the colours', async () => {
  renderConsoleAt(AT, languagesRoutes());
  const section = await screen.findByRole('region', { name: 'What the mail inherits' });
  expect(within(section).getByRole('heading', { level: 2 })).toHaveTextContent(
    'What the mail inherits',
  );
  expect(within(section).getByText(/follows the tenant’s published theme/u)).toBeVisible();
});

it('reads what the mail inherits only when the Mail tab is open', async () => {
  const { sent } = renderConsoleAt('/console/acme/branding', languagesRoutes());
  await screen.findByRole('tab', { name: 'Mail' });
  expect(sent.some((request) => request.path === ML)).toBe(false);
});

it('has nothing axe can find in either theme', async () => {
  const { element } = consoleAt(AT, languagesRoutes());
  const found = await axeInBothThemes(
    () => element,
    () => screen.findByRole('region', { name: 'Light colours' }),
    { frames: false },
  );
  expect(found).toEqual({ light: [], dark: [] });
});
