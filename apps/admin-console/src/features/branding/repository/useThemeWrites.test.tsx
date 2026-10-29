import type { ThemeView } from '@odudu/contracts/admin';
import { act, renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useThemeWrites } from '#/features/branding/repository/useThemeWrites';
import { draftedView, TH, themeView } from '#/testing/brandingFixtures';
import { json, problem } from '#/testing/fakeTransport';
import { hookHarness as harness } from '#/testing/hookHarness';

const TENANT = { kind: 'tenant' } as const;

it('writes what a publish answers over the theme record, and asks for the versions again', async () => {
  const published = { ...draftedView(), draft: null, warnings: [] };
  const { wrapper, queryClient, invalidated } = harness({
    [`POST ${TH}/publish`]: json(published),
  });
  const { result } = renderHook(() => useThemeWrites('acme', TENANT), { wrapper });
  await act(async () => {
    await result.current.publish.run('"d1"');
  });
  const entry = queryClient.getQueryData<{ result: { data: ThemeView; etag: string }; by: string }>(
    ['record', 'acme', 'theme'],
  );
  expect(entry?.by).toBe('save');
  expect(entry?.result.data.draft).toBeNull();
  expect(entry?.result.etag).toBe('"no-draft"');
  expect(invalidated).toHaveBeenCalledWith({ queryKey: ['theme-versions', 'acme', 'tenant'] });
});

it('reads the theme again when a publish finds the draft has moved on', async () => {
  const { wrapper, invalidated } = harness({
    [`POST ${TH}/publish`]: problem(412, 'about:blank', 'Precondition Failed'),
  });
  const { result } = renderHook(() => useThemeWrites('acme', TENANT), { wrapper });
  await act(async () => {
    await result.current.publish.run('"old"');
  });
  expect(invalidated).toHaveBeenCalledWith({ queryKey: ['record', 'acme', 'theme'], exact: true });
});

it('changes nothing when a restore or a reset is refused', async () => {
  const { wrapper, queryClient } = harness({
    [`POST ${TH}/versions/v1/restore`]: problem(
      409,
      'about:blank#theme-assets-missing',
      'Conflict',
    ),
    [`DELETE ${TH}`]: problem(403, 'about:blank', 'Forbidden'),
  });
  const { result } = renderHook(() => useThemeWrites('acme', TENANT), { wrapper });
  await act(async () => {
    await result.current.restore.run('v1');
    await result.current.reset.run();
  });
  expect(queryClient.getQueryData(['record', 'acme', 'theme'])).toBeUndefined();
});

it('writes a reset’s answer over the record', async () => {
  const { wrapper, queryClient } = harness({ [`DELETE ${TH}`]: json(themeView()) });
  const { result } = renderHook(() => useThemeWrites('acme', TENANT), { wrapper });
  await act(async () => {
    await result.current.reset.run();
  });
  expect(queryClient.getQueryData(['record', 'acme', 'theme'])).toBeDefined();
});
