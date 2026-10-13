import { act, renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useCreateClientRole } from '#/features/clients/repository/useClientRoles';
import { json } from '#/testing/fakeTransport';
import { hookHarness } from '#/testing/hookHarness';
import { A } from '#/testing/clientsFixtures';
import { role } from '#/testing/subjectsFixtures';

it('reads the lists and pickers that show it again once it is created, and not when it is refused', async () => {
  const { wrapper, invalidated } = hookHarness({
    [`POST ${A}/roles`]: json(role('r-new', 'billing'), 201),
  });
  const { result } = renderHook(() => useCreateClientRole('acme', 'c1'), { wrapper });
  await act(async () => {
    await result.current.create({ name: 'billing', description: '' });
  });
  expect(invalidated).toHaveBeenCalledWith({ queryKey: ['list', 'acme', 'clients/c1/roles'] });
  expect(invalidated).toHaveBeenCalledWith({ queryKey: ['count', 'acme', 'clients/c1/roles'] });
  expect(invalidated).toHaveBeenCalledWith({ queryKey: ['list', 'acme', 'roles'] });
  expect(invalidated).toHaveBeenCalledWith({ queryKey: ['picker', 'acme', 'roles'] });
});

it('reads nothing again when the creation was refused', async () => {
  const { wrapper, invalidated } = hookHarness({});
  const { result } = renderHook(() => useCreateClientRole('acme', 'c1'), { wrapper });
  await act(async () => {
    await result.current.create({ name: 'billing', description: '' });
  });
  expect(invalidated).not.toHaveBeenCalled();
});
