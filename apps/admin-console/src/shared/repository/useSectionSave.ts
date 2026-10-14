import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { recordKey } from '#/shared/repository/queryKeys';
import type { RecordEntry } from '#/shared/repository/useRecord';
import { useSectionDraft } from '#/shared/repository/useSectionDraft';
import { useToasts } from '#/shared/repository/useToasts';
import type { Conflict } from '#/shared/service/conflict';
import type { Values } from '#/shared/service/dirty';
import { draftFieldsOf } from '#/shared/service/drafts';
import type { AdminCapability } from '#/shared/service/principal';
import {
  afterSave,
  canKeepMine,
  canSubmit,
  canTakeTheirs,
  changedFields,
  conflictsOf,
  currentSection,
  discardedSection,
  editedSection,
  fieldValues,
  hasEdits,
  heldEtag,
  isSaving,
  mineKept,
  rereadPhase,
  restoredShown,
  saveOutcome,
  savingSection,
  sectionBlocked,
  settlesAfter,
  statusOf,
  theirsTaken,
  valuesOf,
  type ConflictSource,
  type SaveOutcome,
  type SaveStatus,
  type SectionField,
  type SectionFields,
  type SectionState,
} from '#/shared/service/sectionSave';
import type { Gateway, GatewayFailure, GatewayResult } from '#/shared/transport/gateway';
import type { Problem } from '#/shared/transport/problem';
import { useTransport } from '#/shared/transport/useTransport';
import { useLatest } from '#/shared/repository/useLatest';

export type { SectionField, SectionFields };

export interface SaveInput<T extends Values> {
  changes: Partial<T>;
  values: T;
  ifMatch: string;
}

export type { ConflictSource, SaveStatus };

// What `useRefusal.report` answers to: a 403 names the capability it needed.
export interface RefusalReporter {
  report: (failure: GatewayFailure, needed: AdminCapability) => boolean;
}

export interface SectionSave<T extends Values> {
  status: SaveStatus;
  fieldErrors: Readonly<Partial<Record<keyof T & string, string>>>;
  conflicts: readonly Conflict[];
  conflictSource: ConflictSource;
  // Why Save is held, for Section's `blocked`.
  blocked: string | undefined;
  // Reads the record again, after a 412 whose fresh read failed.
  reread: () => void;
  // Re-saves every edit on the fresh ETag.
  keepMine: () => void;
  // Drops the conflicting edits and keeps the rest.
  takeTheirs: () => void;
  values: T;
  changed: readonly (keyof T & string)[];
  dirty: boolean;
  saving: boolean;
  restored: boolean;
  // A refusal that belongs beside the save: a guard's 409, or the
  // capability a 403 needed.
  message: string | null;
  edit: <K extends keyof T & string>(field: K, value: T[K]) => void;
  discard: () => void;
  // False when it declined to send, for Section's `onSave`.
  submit: () => boolean;
}

// One section of a record, from its first edit to its save: the If-Match it
// sends, one request at a time, errors under their fields, and a 412 shown
// as theirs beside yours. The record is read through `useRecord` under the
// same tenant and record, and `save` answers the record as that read does:
// the answer replaces it, which rebases the record's other dirty sections.
export function useSectionSave<T extends Values, R>({
  tenant,
  record,
  section,
  label = section,
  etag,
  capability,
  gone = false,
  refusal,
  onRefused,
  explain,
  fields,
  save,
}: {
  tenant: string;
  record: string;
  section: string;
  label?: string;
  // The ETag the record was read with: a section mounts once it is read.
  etag: string;
  // What the save needs, named when a 403 refuses it.
  capability: AdminCapability;
  // The record was found deleted since it was read (`useRecord`'s `gone`).
  gone?: boolean;
  // Told of a refusal with the capability it needed (`useRefusal`).
  refusal: RefusalReporter;
  // Told of a refusal after `refusal`, for whatever else it should set going.
  onRefused?: (failure: GatewayFailure) => void;
  // Says what a 403 or 409 means for this section, in place of the default.
  explain?: (problem: Problem) => string | null;
  fields: SectionFields<T>;
  save: (gateway: Gateway, input: SaveInput<T>) => Promise<GatewayResult<R>>;
}): SectionSave<T> {
  const { gateway } = useTransport();
  const client = useQueryClient();
  const fresh = fieldValues(fields);
  const [state, setState] = useState<SectionState<T> | null>(null);
  const draftEdits = state?.edits ?? {};
  const push = useToasts((queue) => queue.push);
  const { restored, settle } = useSectionDraft({
    tenant,
    record,
    section,
    label,
    dirty: hasEdits(draftEdits),
    fields: draftFieldsOf(draftEdits, fields),
    etag: heldEtag(state, etag),
  });

  const current = currentSection(state, fresh, etag, restored);
  if (current !== state) setState(current);

  const latest = useLatest(current);
  const inFlight = useRef(false);

  const update = (change: (was: SectionState<T>) => SectionState<T>): void => {
    setState((was) => (was === null ? was : change(was)));
  };

  const toast = (outcome: SaveOutcome): void => {
    if (outcome.toast !== undefined) push(outcome.toast);
  };

  const answer = async (from: SectionState<T>, result: GatewayResult<R>): Promise<void> => {
    const outcome = saveOutcome(result, {
      label,
      capability,
      explain,
      fields: Object.keys(from.base),
    });
    if (result.ok) {
      const entry: RecordEntry<R> = { result, by: 'save' };
      client.setQueryData(recordKey(tenant, record), entry);
      update((was) => afterSave(was, outcome, from.edits));
      settle();
      toast(outcome);
      return;
    }
    let phase = outcome.phase;
    if (outcome.refetch) {
      await client.refetchQueries({ queryKey: recordKey(tenant, record), exact: true });
      phase = rereadPhase(client.getQueryState(recordKey(tenant, record))?.status);
    }
    update((was) => afterSave(was, { ...outcome, phase }, from.edits));
    toast(outcome);
    if (outcome.refused) {
      refusal.report(result, capability);
      onRefused?.(result);
    }
  };

  const run = async (from: SectionState<T>): Promise<void> => {
    inFlight.current = true;
    update(savingSection);
    const attempt = async (): Promise<void> => {
      const values = valuesOf(from);
      await answer(from, await save(gateway, { changes: from.edits, values, ifMatch: from.etag }));
    };
    await attempt()
      .catch(() => {
        const failed = saveOutcome(
          { ok: false, kind: 'defect' },
          { label, capability, fields: [] },
        );
        update((was) => afterSave(was, failed, from.edits));
        toast(failed);
      })
      .finally(() => {
        inFlight.current = false;
      });
  };

  const changed = changedFields(current);
  const conflicts: Conflict[] = conflictsOf(current, fields);

  return {
    status: statusOf(current),
    fieldErrors: current.fieldErrors as SectionSave<T>['fieldErrors'],
    conflicts,
    conflictSource: current.source,
    blocked: sectionBlocked(gone, conflicts.length, current.phase),
    reread: () => {
      client
        .refetchQueries({ queryKey: recordKey(tenant, record), exact: true })
        .catch(() => undefined);
    },
    keepMine: () => {
      const from = latest();
      if (!canKeepMine(from, gone, inFlight.current)) return;
      update(mineKept);
      run(mineKept(from)).catch(() => undefined);
    },
    takeTheirs: () => {
      const from = latest();
      if (!canTakeTheirs(from, inFlight.current)) return;
      update(theirsTaken);
      if (settlesAfter(theirsTaken(from))) settle();
    },
    values: valuesOf(current),
    changed,
    dirty: hasEdits(current.edits),
    saving: isSaving(current),
    restored: restoredShown(restored, current),
    message: current.message,
    edit: (field, value) => {
      update((was) => editedSection(was, field, value));
    },
    discard: () => {
      update(discardedSection);
      settle();
    },
    submit: () => {
      const from = latest();
      if (!canSubmit(from, gone, inFlight.current)) return false;
      run(from).catch(() => undefined);
      return true;
    },
  };
}
