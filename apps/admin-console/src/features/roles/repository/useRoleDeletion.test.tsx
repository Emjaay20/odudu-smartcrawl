import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useRoleDeletion } from '#/features/roles/repository/useRoleRecord';
import { groupKey } from '#/shared/repository/queryKeys';
import { pending } from '#/testing/fakeTransport';
import { hookHarness } from '#/testing/hookHarness';

const PATH = 'DELETE /console/api/admin/tenants/acme/roles/x1';

it('deletes the role, reads its lists again once it is gone and answers the result', async () => {
  const { wrapper, invalidated } = hookHarness({
    [PATH]: () => new Response(null, { status: 204 }),
  });
  const { result } = renderHook(() => useRoleDeletion('acme', 'x1'), { wrapper });
  let answer: Awaited<ReturnType<typeof result.current.run>> | undefined;
  await act(async () => {
    answer = await result.current.run();
  });
  expect(answer?.ok).toBe(true);
  expect(invalidated).toHaveBeenCalledWith({ queryKey: ['list', 'acme'] });
});

it('is busy from the press until the server answers', async () => {
  const { wrapper } = hookHarness({ [PATH]: pending() });
  const { result } = renderHook(() => useRoleDeletion('acme', 'x1'), { wrapper });
  expect(result.current.busy).toBe(false);
  act(() => {
    result.current.run().catch(() => undefined);
  });
  await waitFor(() => {
    expect(result.current.busy).toBe(true);
  });
});

it("leaves the deleted role's own group read to lapse and reads the others' again", async () => {
  const { wrapper, queryClient } = hookHarness({
    [PATH]: () => new Response(null, { status: 204 }),
  });
  queryClient.setQueryData(groupKey('acme', 'x1'), 'held');
  queryClient.setQueryData(groupKey('acme', 'x2'), 'held');
  const { result } = renderHook(() => useRoleDeletion('acme', 'x1'), { wrapper });
  await act(async () => {
    await result.current.run();
  });
  expect(queryClient.getQueryState(groupKey('acme', 'x1'))?.isInvalidated).toBe(false);
  expect(queryClient.getQueryState(groupKey('acme', 'x2'))?.isInvalidated).toBe(true);
});

it("leaves the deleted record's own entries to lapse and reads the others' again", async () => {
  const { wrapper, queryClient } = hookHarness({
    [PATH]: () => new Response(null, { status: 204 }),
  });
  queryClient.setQueryData(['record', 'acme', 'roles/x1'], 'held');
  queryClient.setQueryData(['record', 'acme', 'roles/x1/sub'], 'held');
  queryClient.setQueryData(['record', 'acme', 'roles/x2'], 'held');
  const { result } = renderHook(() => useRoleDeletion('acme', 'x1'), { wrapper });
  await act(async () => {
    await result.current.run();
  });
  expect(queryClient.getQueryState(['record', 'acme', 'roles/x1'])?.isInvalidated).toBe(false);
  expect(queryClient.getQueryState(['record', 'acme', 'roles/x1/sub'])?.isInvalidated).toBe(false);
  expect(queryClient.getQueryState(['record', 'acme', 'roles/x2'])?.isInvalidated).toBe(true);
});
