import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useGroupDeletion } from '#/features/groups/repository/useGroupRecord';
import { pending } from '#/testing/fakeTransport';
import { hookHarness } from '#/testing/hookHarness';

const PATH = 'DELETE /console/api/admin/tenants/acme/groups/x1';

it('deletes the group, reads its lists again once it is gone and answers the result', async () => {
  const { wrapper, invalidated } = hookHarness({
    [PATH]: () => new Response(null, { status: 204 }),
  });
  const { result } = renderHook(() => useGroupDeletion('acme', 'x1'), { wrapper });
  let answer: Awaited<ReturnType<typeof result.current.run>> | undefined;
  await act(async () => {
    answer = await result.current.run();
  });
  expect(answer?.ok).toBe(true);
  expect(invalidated).toHaveBeenCalledWith({ queryKey: ['list', 'acme'] });
});

it('is busy from the press until the server answers', async () => {
  const { wrapper } = hookHarness({ [PATH]: pending() });
  const { result } = renderHook(() => useGroupDeletion('acme', 'x1'), { wrapper });
  expect(result.current.busy).toBe(false);
  act(() => {
    result.current.run().catch(() => undefined);
  });
  await waitFor(() => {
    expect(result.current.busy).toBe(true);
  });
});
