import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useClientDeletion } from '#/features/clients/repository/useClientRecord';
import { pending } from '#/testing/fakeTransport';
import { hookHarness } from '#/testing/hookHarness';

const PATH = 'DELETE /console/api/admin/tenants/acme/clients/x1';

it('deletes the client, reads its lists again once it is gone and answers the result', async () => {
  const { wrapper, invalidated } = hookHarness({
    [PATH]: () => new Response(null, { status: 204 }),
  });
  const { result } = renderHook(() => useClientDeletion('acme', 'x1'), { wrapper });
  let answer: Awaited<ReturnType<typeof result.current.run>> | undefined;
  await act(async () => {
    answer = await result.current.run();
  });
  expect(answer?.ok).toBe(true);
  expect(invalidated).toHaveBeenCalledWith({ queryKey: ['list', 'acme', 'clients'] });
});

it('is busy from the press until the server answers', async () => {
  const { wrapper } = hookHarness({ [PATH]: pending() });
  const { result } = renderHook(() => useClientDeletion('acme', 'x1'), { wrapper });
  expect(result.current.busy).toBe(false);
  act(() => {
    result.current.run().catch(() => undefined);
  });
  await waitFor(() => {
    expect(result.current.busy).toBe(true);
  });
});

it("reads again the lists the client's removal changes, and leaves its own record to lapse", async () => {
  const { wrapper, queryClient } = hookHarness({
    [PATH]: () => new Response(null, { status: 204 }),
  });
  const held = [
    ['list', 'acme', 'roles'],
    ['picker', 'acme', 'roles'],
    ['scope-clients', 'acme', 's1'],
    ['list', 'acme', 'subjects/u1/consents'],
    ['record', 'acme', 'clients/x1'],
    ['list', 'other', 'roles'],
  ];
  for (const key of held) queryClient.setQueryData(key, 'held');
  const { result } = renderHook(() => useClientDeletion('acme', 'x1'), { wrapper });
  await act(async () => {
    await result.current.run();
  });
  const stale = held.map((key) => queryClient.getQueryState(key)?.isInvalidated);
  expect(stale).toEqual([true, true, true, true, false, false]);
});
