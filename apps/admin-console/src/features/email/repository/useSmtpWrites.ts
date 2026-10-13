import type { TestSmtpResponse } from '@odudu/contracts/admin';
import { deleteSmtp, testSmtp } from '#/features/email/adapter/smtp';
import { useGatewayWrite, type Write } from '#/shared/repository/useWrite';
import type { GatewayResult } from '#/shared/transport/gateway';

export function useSmtpTest(tenant: string): Write<string, GatewayResult<TestSmtpResponse>> {
  return useGatewayWrite({ send: (gateway, to: string) => testSmtp(gateway, tenant, to) });
}

export function useSmtpRemove(tenant: string): Write<void, GatewayResult<undefined>> {
  return useGatewayWrite({ send: (gateway) => deleteSmtp(gateway, tenant) });
}
