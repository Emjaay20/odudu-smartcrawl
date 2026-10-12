import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { expect, it, vi } from 'vitest';
import {
  useDeleteKey,
  usePromoteKey,
  useRetireKey,
  useStageKey,
} from '#/features/signing-keys/repository/useKeyWrites';
import { createQueryClient } from '#/shared/repository/queryClient';
import { TransportContext } from '#/shared/transport/useTransport';
import { fakeTransport, json, problem, type Answer } from '#/testing/fakeTransport';
import { KEYS, READY_KEY } from '#/testing/keysFixtures';

function harness(routes: Record<string, Answer>) {
  const fake = fakeTransport(routes);
  const queryClient = createQueryClient();
  const invalidated = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <TransportContext value={fake.transport}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </TransportContext>
  );
  return { ...fake, invalidated, wrapper };
}

it('stages a key of the algorithm chosen and reads the lanes and the overview again', async () => {
  const { wrapper, sent, invalidated } = harness({ [`POST ${KEYS}`]: json(READY_KEY, 201) });
  const { result } = renderHook(() => useStageKey('acme'), { wrapper });
  let answer: Awaited<ReturnType<typeof result.current.run>> | undefined;
  await act(async () => {
    answer = await result.current.run('RS256');
  });
  expect(answer?.ok).toBe(true);
  expect(sent.find((s) => s.method === 'POST')?.body).toEqual({ alg: 'RS256' });
  expect(invalidated).toHaveBeenCalledWith({ queryKey: ['list', 'acme', 'keys'] });
  expect(invalidated).toHaveBeenCalledWith({ queryKey: ['overview', 'acme'] });
});

it('sends a stage once for one press, however often it is pressed', async () => {
  const { wrapper, sent } = harness({ [`POST ${KEYS}`]: json(READY_KEY, 201) });
  const { result } = renderHook(() => useStageKey('acme'), { wrapper });
  await act(async () => {
    await Promise.all([result.current.run('ES256'), result.current.run('ES256')]);
  });
  expect(sent.filter((s) => s.method === 'POST')).toHaveLength(1);
});

it('promotes and retires by id with no body and no If-Match', async () => {
  const { wrapper, sent } = harness({
    [`POST ${KEYS}/k1/promote`]: json(READY_KEY),
    [`POST ${KEYS}/k2/retire`]: json(READY_KEY),
  });
  const promote = renderHook(() => usePromoteKey('acme'), { wrapper });
  const retire = renderHook(() => useRetireKey('acme'), { wrapper });
  await act(async () => {
    await promote.result.current.run('k1');
    await retire.result.current.run('k2');
  });
  expect(sent.map((s) => `${s.method} ${s.path}`)).toEqual([
    `POST ${KEYS}/k1/promote`,
    `POST ${KEYS}/k2/retire`,
  ]);
  expect(sent.every((s) => s.ifMatch === null && s.body === undefined)).toBe(true);
});

it('reads the lanes again whatever the answer, a refusal included', async () => {
  const { wrapper, invalidated } = harness({
    [`DELETE ${KEYS}/k1`]: problem(409, 'about:blank#key-not-retired', 'Conflict'),
  });
  const { result } = renderHook(() => useDeleteKey('acme'), { wrapper });
  let answer: Awaited<ReturnType<typeof result.current.run>> | undefined;
  await act(async () => {
    answer = await result.current.run('k1');
  });
  expect(answer?.ok).toBe(false);
  expect(invalidated).toHaveBeenCalledWith({ queryKey: ['list', 'acme', 'keys'] });
});
