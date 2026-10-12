import type { TestSmtpResponse } from '@odudu/contracts/admin';
import { useMutation } from '@tanstack/react-query';
import { deleteSmtp, testSmtp } from '#/features/email/adapter/smtp';
import type { GatewayResult } from '#/shared/transport/gateway';
import { useTransport } from '#/shared/transport/useTransport';

export interface SmtpTest {
  busy: boolean;
  run: (to: string) => Promise<GatewayResult<TestSmtpResponse>>;
}

export function useSmtpTest(tenant: string): SmtpTest {
  const { gateway } = useTransport();
  const mutation = useMutation({
    mutationFn: (to: string) =>
      testSmtp(gateway, tenant, to).catch((): GatewayResult<TestSmtpResponse> => {
        return { ok: false, kind: 'defect' };
      }),
  });
  return { busy: mutation.isPending, run: (to) => mutation.mutateAsync(to) };
}

export interface SmtpRemove {
  busy: boolean;
  run: () => Promise<GatewayResult<undefined>>;
}

export function useSmtpRemove(tenant: string): SmtpRemove {
  const { gateway } = useTransport();
  const mutation = useMutation({
    mutationFn: () =>
      deleteSmtp(gateway, tenant).catch((): GatewayResult<undefined> => {
        return { ok: false, kind: 'defect' };
      }),
  });
  return { busy: mutation.isPending, run: () => mutation.mutateAsync() };
}
