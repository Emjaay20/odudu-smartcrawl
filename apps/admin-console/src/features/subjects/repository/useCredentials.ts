import type {
  IssuePasswordResponse,
  ListCredentialsResponse,
  Lockout,
} from '@odudu/contracts/admin';
import { useQueryClient } from '@tanstack/react-query';
import { useRead } from '#/shared/repository/useRead';
import type { Read } from '#/shared/service/read';
import {
  changeCredential,
  readCredentials,
  readLockout,
} from '#/features/subjects/adapter/subjects';
import type { CredentialChange } from '#/features/subjects/service';
import { issuePassword } from '#/shared/adapter/administrators';
import { useSecretOnce, type SecretOnce } from '#/shared/repository/useSecretOnce';
import { useWrite, type Write } from '#/shared/repository/useWrite';
import type { GatewayFailure, GatewayResult } from '#/shared/transport/gateway';
import { useTransport } from '#/shared/transport/useTransport';

function credentialsKey(tenant: string, id: string) {
  return ['credentials', tenant, id] as const;
}

function lockoutKey(tenant: string, id: string) {
  return ['lockout', tenant, id] as const;
}

export function useCredentials(
  tenant: string,
  id: string,
  asked: boolean,
): Read<ListCredentialsResponse> {
  const { gateway } = useTransport();
  return useRead(credentialsKey(tenant, id), asked, () => readCredentials(gateway, tenant, id));
}

export function useLockout(tenant: string, id: string, asked: boolean): Read<Lockout> {
  const { gateway } = useTransport();
  return useRead(lockoutKey(tenant, id), asked, () => readLockout(gateway, tenant, id));
}

export type { CredentialChange };

// Each change re-reads what it changed, so the tab shows the server's word.
export function useCredentialChanges(
  tenant: string,
  id: string,
): Write<CredentialChange, GatewayResult<undefined>> {
  const client = useQueryClient();
  return useWrite({
    send: (gateway, change: CredentialChange) => changeCredential(gateway, tenant, id, change),
    onSettled: (_result, change) => {
      const key = change.kind === 'lockout' ? lockoutKey(tenant, id) : credentialsKey(tenant, id);
      client.invalidateQueries({ queryKey: key, exact: true }).catch(() => undefined);
    },
  });
}

// Issuing replaces the password and clears any lockout, so both are read
// again. The caller is told how it ended from the write itself, not a render.
export function useIssuePassword(
  tenant: string,
  id: string,
  told: {
    issued: () => void;
    refused: (failure: GatewayFailure) => void;
  },
): SecretOnce<void, null> {
  const client = useQueryClient();
  return useSecretOnce({
    run: async (gateway) => {
      let result: GatewayResult<IssuePasswordResponse>;
      try {
        result = await issuePassword(gateway, tenant, id);
      } catch (error) {
        told.refused({ ok: false, kind: 'defect' });
        throw error;
      }
      if (!result.ok) {
        told.refused(result);
        return result;
      }
      for (const key of [credentialsKey(tenant, id), lockoutKey(tenant, id)]) {
        client.invalidateQueries({ queryKey: key, exact: true }).catch(() => undefined);
      }
      told.issued();
      return result;
    },
    split: (data) => ({ secret: data.password, rest: null }),
  });
}
