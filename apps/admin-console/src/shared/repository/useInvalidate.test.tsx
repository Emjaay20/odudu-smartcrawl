import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { expect, it, vi } from 'vitest';
import { createQueryClient } from '#/shared/repository/queryClient';
import { useInvalidate } from '#/shared/repository/useInvalidate';

function harness() {
  const queryClient = createQueryClient();
  const invalidated = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, invalidated, wrapper };
}

it('invalidates each key it is given, by prefix', () => {
  const { invalidated, wrapper } = harness();
  const { result } = renderHook(() => useInvalidate(), { wrapper });
  result.current.invalidate(['list', 'acme'], ['picker', 'acme', 'roles']);
  expect(invalidated.mock.calls).toEqual([
    [{ queryKey: ['list', 'acme'] }],
    [{ queryKey: ['picker', 'acme', 'roles'] }],
  ]);
});

it('invalidates exactly the one key when asked to', () => {
  const { invalidated, wrapper } = harness();
  const { result } = renderHook(() => useInvalidate(), { wrapper });
  result.current.invalidateExact(['record', 'acme', 'roles/r1']);
  expect(invalidated).toHaveBeenCalledWith({
    queryKey: ['record', 'acme', 'roles/r1'],
    exact: true,
  });
});

it('marks only the queries under the key stale', () => {
  const { queryClient, wrapper } = harness();
  queryClient.setQueryData(['list', 'acme', 'roles'], 'held');
  queryClient.setQueryData(['list', 'other', 'roles'], 'held');
  const { result } = renderHook(() => useInvalidate(), { wrapper });
  result.current.invalidate(['list', 'acme']);
  expect(queryClient.getQueryState(['list', 'acme', 'roles'])?.isInvalidated).toBe(true);
  expect(queryClient.getQueryState(['list', 'other', 'roles'])?.isInvalidated).toBe(false);
});

it('leaves no rejection unhandled when the read again fails', async () => {
  const unhandled = vi.fn();
  process.on('unhandledRejection', unhandled);
  const { invalidated, wrapper } = harness();
  invalidated.mockRejectedValue(new Error('refetch failed'));
  const { result } = renderHook(() => useInvalidate(), { wrapper });
  result.current.invalidate(['list', 'acme']);
  result.current.invalidateExact(['record', 'acme', 'x']);
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
  process.off('unhandledRejection', unhandled);
  expect(invalidated).toHaveBeenCalledTimes(2);
  expect(unhandled).not.toHaveBeenCalled();
});
