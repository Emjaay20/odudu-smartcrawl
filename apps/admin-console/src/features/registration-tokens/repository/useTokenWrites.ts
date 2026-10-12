import type { MintRegistrationTokenResponse } from '@odudu/contracts/admin';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { mintToken, revokeToken } from '#/features/registration-tokens/adapter/registrationTokens';
import { useSecretOnce, type SecretOnce } from '#/shared/repository/useSecretOnce';
import type { GatewayFailure, GatewayResult } from '#/shared/transport/gateway';
import { useTransport } from '#/shared/transport/useTransport';

type Minted = Omit<MintRegistrationTokenResponse, 'token'>;

function useListRead(tenant: string): () => void {
  const client = useQueryClient();
  return () => {
    client.invalidateQueries({ queryKey: ['list', tenant, 'registration-tokens'] }).catch(() => {
      return undefined;
    });
  };
}

export interface TokenMint {
  busy: boolean;
  start: SecretOnce<{ uses: number; ttl_seconds: number }, Minted>['start'];
  // For the SecretDialog, and for nothing else.
  secret: string | null;
  close: () => void;
}

// The token goes to its dialog alone; what remains of the answer is told on.
export function useTokenMint(
  tenant: string,
  told: { minted: (token: Minted) => void; failed: (failure: GatewayFailure) => void },
): TokenMint {
  const read = useListRead(tenant);
  const once = useSecretOnce({
    run: async (gateway, input: { uses: number; ttl_seconds: number }) => {
      const result = await mintToken(gateway, tenant, input);
      if (result.ok) {
        read();
      } else {
        told.failed(result);
      }
      return result;
    },
    split: ({ token, ...rest }) => {
      told.minted(rest);
      return { secret: token, rest };
    },
  });
  return { busy: once.busy, start: once.start, secret: once.secret, close: once.close };
}

export interface TokenRevoke {
  busy: boolean;
  run: (id: string) => Promise<GatewayResult<undefined>>;
}

// Whatever the answer, the list is read again: revoked, already gone or lost, it may be stale.
export function useTokenRevoke(tenant: string): TokenRevoke {
  const { gateway } = useTransport();
  const read = useListRead(tenant);
  const mutation = useMutation({
    mutationFn: (id: string) =>
      revokeToken(gateway, tenant, id).catch((): GatewayResult<undefined> => {
        return { ok: false, kind: 'defect' };
      }),
    onSettled: read,
  });
  return { busy: mutation.isPending, run: (id) => mutation.mutateAsync(id) };
}
