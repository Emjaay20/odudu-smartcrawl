import type { RegistrationToken } from '@odudu/contracts/admin';
import { useState } from 'react';
import { useRefusal } from '#/features/session';
import { useTokenList } from '#/features/registration-tokens/repository/useTokenList';
import {
  useTokenMint,
  useTokenRevoke,
} from '#/features/registration-tokens/repository/useTokenWrites';
import {
  clearedError,
  DEFAULT_MINT,
  isValid,
  mintedText,
  mintFailure,
  mintProblems,
  revokeConsequence,
  revokeOutcome,
  type MintErrors,
} from '#/features/registration-tokens/service';
import { useToast } from '#/shared/repository/useToasts';
import type { ResourceListState } from '#/shared/service/resourceList';

export interface RegistrationTokensPage {
  list: ResourceListState<RegistrationToken>;
  uses: number;
  lifetime: number;
  editUses: (value: number) => void;
  editLifetime: (value: number) => void;
  errors: MintErrors;
  message: string | null;
  minting: boolean;
  mint: () => void;
  // For the SecretDialog, and for nothing else.
  secret: string | null;
  closeSecret: () => void;
  revoking: RegistrationToken | null;
  consequence: string;
  revokeBusy: boolean;
  revokeProblem: string | null;
  // What the last revoke came to, for the line beside the list.
  notice: string | null;
  // How many revokes have ended the token, for a view that moves focus once the dialog is gone.
  revoked: number;
  ask: (token: RegistrationToken) => void;
  cancel: () => void;
  confirm: () => Promise<boolean>;
}

export function useRegistrationTokensPage(tenant: string): RegistrationTokensPage {
  const refusal = useRefusal(tenant);
  const toast = useToast();
  const list = useTokenList(tenant);
  const revoke = useTokenRevoke(tenant);
  const [uses, setUses] = useState(DEFAULT_MINT.uses);
  const [lifetime, setLifetime] = useState(DEFAULT_MINT.ttl_seconds);
  const [errors, setErrors] = useState<MintErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<RegistrationToken | null>(null);
  const [revokeProblem, setRevokeProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [revoked, setRevoked] = useState(0);
  const minting = useTokenMint(tenant, {
    minted: (token) => {
      toast.succeeded(mintedText(token));
    },
    failed: (failure) => {
      const outcome = mintFailure(failure);
      setErrors(outcome.errors);
      setMessage(outcome.message);
      if (outcome.report) refusal.report(failure, 'manage-clients');
    },
  });
  return {
    list,
    uses,
    lifetime,
    editUses: (value) => {
      setUses(value);
      setErrors((was) => clearedError(was, 'uses'));
    },
    editLifetime: (value) => {
      setLifetime(value);
      setErrors((was) => clearedError(was, 'ttl_seconds'));
    },
    errors,
    message,
    minting: minting.busy,
    mint: () => {
      const problems = mintProblems({ uses, ttl_seconds: lifetime });
      setErrors(problems);
      setMessage(null);
      if (isValid(problems)) minting.start({ uses, ttl_seconds: lifetime });
    },
    secret: minting.secret,
    closeSecret: minting.close,
    revoking,
    consequence: revoking === null ? '' : revokeConsequence(revoking),
    revokeBusy: revoke.busy,
    revokeProblem,
    notice,
    revoked,
    ask: (token) => {
      setRevokeProblem(null);
      setRevoking(token);
    },
    cancel: () => {
      setRevoking(null);
    },
    confirm: async () => {
      if (revoking === null) return false;
      const result = await revoke.run(revoking.id);
      const outcome = revokeOutcome(result);
      if (!outcome.done) {
        setRevokeProblem(outcome.text);
        refusal.report(result, 'manage-clients');
        return false;
      }
      setRevoking(null);
      setNotice(outcome.text);
      setRevoked((count) => count + 1);
      return true;
    },
  };
}
