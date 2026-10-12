import type { SigningKey, SigningKeyAlg } from '@odudu/contracts/admin';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { deleteKey, promoteKey, retireKey, stageKey } from '#/features/signing-keys/adapter/keys';
import type { Gateway, GatewayResult } from '#/shared/transport/gateway';
import { useTransport } from '#/shared/transport/useTransport';

export interface KeyWrite<Input, Answer> {
  busy: boolean;
  run: (input: Input) => Promise<GatewayResult<Answer>>;
}

// A write's answer changes the lanes and what the overview says about the
// keys, whatever it was: a refused or lost one may still have left them stale.
function useKeysRead(tenant: string): () => void {
  const client = useQueryClient();
  return () => {
    for (const queryKey of [
      ['list', tenant, 'keys'],
      ['overview', tenant],
    ]) {
      client.invalidateQueries({ queryKey }).catch(() => undefined);
    }
  };
}

function useKeyWrite<Input, Answer>(
  tenant: string,
  send: (gateway: Gateway, input: Input) => Promise<GatewayResult<Answer>>,
): KeyWrite<Input, Answer> {
  const { gateway } = useTransport();
  const read = useKeysRead(tenant);
  // One press is one write, however often it is pressed before the first answer.
  const sending = useRef(false);
  const mutation = useMutation({
    mutationFn: (input: Input) =>
      send(gateway, input).catch((): GatewayResult<Answer> => {
        return { ok: false, kind: 'defect' };
      }),
    onSettled: () => {
      sending.current = false;
      read();
    },
  });
  return {
    busy: mutation.isPending,
    run: (input) => {
      if (sending.current) return Promise.resolve({ ok: false, kind: 'defect' });
      sending.current = true;
      return mutation.mutateAsync(input);
    },
  };
}

export function useStageKey(tenant: string): KeyWrite<SigningKeyAlg, SigningKey> {
  return useKeyWrite(tenant, (gateway, alg) => stageKey(gateway, tenant, alg));
}

export function usePromoteKey(tenant: string): KeyWrite<string, SigningKey> {
  return useKeyWrite(tenant, (gateway, id) => promoteKey(gateway, tenant, id));
}

export function useRetireKey(tenant: string): KeyWrite<string, SigningKey> {
  return useKeyWrite(tenant, (gateway, id) => retireKey(gateway, tenant, id));
}

export function useDeleteKey(tenant: string): KeyWrite<string, undefined> {
  return useKeyWrite(tenant, (gateway, id) => deleteKey(gateway, tenant, id));
}
