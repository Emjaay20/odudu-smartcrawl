import { act, renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useCreateScope } from '#/features/scopes/repository/useCreateScope';
import { json } from '#/testing/fakeTransport';
import { hookHarness } from '#/testing/hookHarness';
import { SC, scope } from '#/testing/scopesFixtures';

it('reads the lists and pickers that show it again once it is created, and not when it is refused', async () => {
  const { wrapper, invalidated } = hookHarness({
    [`POST ${SC}`]: json(scope('s-new', 'invoices'), 201),
  });
  const { result } = renderHook(() => useCreateScope('acme'), { wrapper });
  await act(async () => {
    await result.current.create({ name: 'invoices', description: '' });
  });
  for (const kind of ['list', 'count', 'picker']) {
    expect(invalidated).toHaveBeenCalledWith({ queryKey: [kind, 'acme', 'scopes'] });
  }
});

it('reads nothing again when the creation was refused', async () => {
  const { wrapper, invalidated } = hookHarness({});
  const { result } = renderHook(() => useCreateScope('acme'), { wrapper });
  await act(async () => {
    await result.current.create({ name: 'invoices', description: '' });
  });
  expect(invalidated).not.toHaveBeenCalled();
});
