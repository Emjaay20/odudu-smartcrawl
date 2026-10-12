import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { expect, it } from 'vitest';
import { useSmtpRemove, useSmtpTest } from '#/features/email/repository/useSmtpWrites';
import { createQueryClient } from '#/shared/repository/queryClient';
import { TransportContext } from '#/shared/transport/useTransport';
import { fakeTransport, json, problem, type Answer } from '#/testing/fakeTransport';
import { SM } from '#/testing/settingsFixtures';

function harness(routes: Record<string, Answer>) {
  const fake = fakeTransport(routes);
  const queryClient = createQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <TransportContext value={fake.transport}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </TransportContext>
  );
  return { ...fake, wrapper };
}

it('sends a test message to the address given and answers what the server said', async () => {
  const { wrapper, sent } = harness({ [`POST ${SM}/test`]: json({ sent: true }) });
  const { result } = renderHook(() => useSmtpTest('acme'), { wrapper });
  let answer: Awaited<ReturnType<typeof result.current.run>> | undefined;
  await act(async () => {
    answer = await result.current.run('a@b.example');
  });
  expect(answer).toMatchObject({ ok: true, data: { sent: true } });
  expect(sent[0]).toMatchObject({ method: 'POST', body: { to: 'a@b.example' } });
});

it('answers a send the server refused as the refusal, not as a thrown error', async () => {
  const { wrapper } = harness({
    [`POST ${SM}/test`]: problem(502, 'about:blank', 'Bad Gateway', { detail: 'ECONNREFUSED' }),
  });
  const { result } = renderHook(() => useSmtpTest('acme'), { wrapper });
  let answer: Awaited<ReturnType<typeof result.current.run>> | undefined;
  await act(async () => {
    answer = await result.current.run('a@b.example');
  });
  expect(answer).toMatchObject({ ok: false, kind: 'problem' });
  await waitFor(() => {
    expect(result.current.busy).toBe(false);
  });
});

it('removes the relay', async () => {
  const { wrapper, sent } = harness({
    [`DELETE ${SM}`]: () => new Response(null, { status: 204 }),
  });
  const { result } = renderHook(() => useSmtpRemove('acme'), { wrapper });
  let answer: Awaited<ReturnType<typeof result.current.run>> | undefined;
  await act(async () => {
    answer = await result.current.run();
  });
  expect(answer?.ok).toBe(true);
  expect(sent[0]).toMatchObject({ method: 'DELETE' });
});
