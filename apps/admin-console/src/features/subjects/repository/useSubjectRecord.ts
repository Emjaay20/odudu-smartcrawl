import type { Profile, Subject } from '@odudu/contracts/admin';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  amendProfile,
  amendSubject,
  deleteSubject,
  readProfile,
  readSubject,
  readUsernameEditable,
} from '#/features/subjects/adapter/subjects';
import {
  recordKey,
  useRecord,
  type RecordEntry,
  type RecordState,
} from '#/shared/repository/useRecord';
import type { SaveInput } from '#/shared/repository/useSectionSave';
import { useWrite, type Write } from '#/shared/repository/useWrite';
import { profileRecord, subjectRecord } from '#/features/subjects/service';
import { isStale } from '#/shared/service/failure';
import type { Gateway, GatewayResult } from '#/shared/transport/gateway';
import { useTransport } from '#/shared/transport/useTransport';

export function useSubjectRecord(tenant: string, id: string): RecordState<Subject> {
  return useRecord({
    tenant,
    record: subjectRecord(id),
    read: (gateway) => readSubject(gateway, tenant, id),
  });
}

export function useProfileRecord(tenant: string, id: string): RecordState<Profile> {
  return useRecord({
    tenant,
    record: profileRecord(id),
    read: (gateway) => readProfile(gateway, tenant, id),
  });
}

export interface AccountValues extends Readonly<Record<string, unknown>> {
  username: string;
  email: string;
}

export function saveAccount(tenant: string, id: string) {
  return (gateway: Gateway, { changes, ifMatch }: SaveInput<AccountValues>) =>
    amendSubject(gateway, tenant, id, changes, ifMatch);
}

export type ClaimValues = Readonly<Record<string, string>>;

export function saveClaims(tenant: string, id: string) {
  return (gateway: Gateway, { changes, ifMatch }: SaveInput<ClaimValues>) =>
    amendProfile(gateway, tenant, id, changes, ifMatch);
}

export interface VerificationValues extends Readonly<Record<string, unknown>> {
  email_verified: boolean;
  phone_number_verified: boolean;
}

export function saveVerification(tenant: string, id: string) {
  return (gateway: Gateway, { changes, ifMatch }: SaveInput<VerificationValues>) =>
    amendProfile(gateway, tenant, id, changes, ifMatch);
}

// Enabling and disabling are one PATCH on the ETag the subject was read
// with; the answer replaces the record, so its sections rebase on it.
export function useSubjectEnabled(
  tenant: string,
  id: string,
  etag: string,
): Write<boolean, GatewayResult<Subject>> {
  const client = useQueryClient();
  const key = recordKey(tenant, subjectRecord(id));
  return useWrite({
    send: (gateway, enabled: boolean) => amendSubject(gateway, tenant, id, { enabled }, etag),
    onSuccess: (result) => {
      if (result.ok) {
        client.setQueryData<RecordEntry<Subject>>(key, { result, by: 'save' });
      } else if (isStale(result)) {
        client.invalidateQueries({ queryKey: key, exact: true }).catch(() => undefined);
      }
    },
  });
}

export function useSubjectDeletion(
  tenant: string,
  id: string,
): Write<void, GatewayResult<undefined>> {
  const client = useQueryClient();
  return useWrite({
    send: (gateway) => deleteSubject(gateway, tenant, id),
    onSuccess: (result) => {
      // The record's own entries are left to lapse: removing them while its
      // page is still mounted would read them again, and find nothing.
      if (!result.ok) return;
      client.invalidateQueries({ queryKey: ['list', tenant, 'subjects'] }).catch(() => undefined);
    },
  });
}

export type UsernamePolicyRead =
  | { status: 'loading' }
  | { status: 'ready'; editable: boolean }
  | { status: 'failed'; retry: () => void };

// Whether a rename would be accepted, as the tenant's policy says.
export function useUsernamePolicy(tenant: string): UsernamePolicyRead {
  const { gateway } = useTransport();
  const client = useQueryClient();
  const key = ['username-policy', tenant] as const;
  const query = useQuery({ queryKey: key, queryFn: () => readUsernameEditable(gateway, tenant) });
  const result = query.data;
  if (result === undefined) return { status: 'loading' };
  if (result.ok) return { status: 'ready', editable: result.data };
  return {
    status: 'failed',
    retry: () => {
      client.invalidateQueries({ queryKey: key, exact: true }).catch(() => undefined);
    },
  };
}
