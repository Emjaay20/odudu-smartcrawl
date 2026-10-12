import type { Client, ClientScope, ScopeClient } from '@odudu/contracts/admin';
import { useState } from 'react';
import { useAuthority, useRefusal } from '#/features/session';
import {
  useClientAssignment,
  useScopeClients,
  type ScopeClients,
} from '#/features/scopes/repository/useScopeClients';
import {
  assignedText,
  assignmentOf,
  chosenClient,
  clientAssignmentFailure,
  clientsCount,
  clientsOffered,
  unassignedText,
} from '#/features/scopes/service';
import { useClientPicker } from '#/shared/repository/useClientPicker';
import { useToasts } from '#/shared/repository/useToasts';
import { lacking } from '#/shared/service/access';
import { lastChosen, type PickerState } from '#/shared/service/picker';
import type { AdminCapability } from '#/shared/service/principal';
import type { GatewayFailure, GatewayResult } from '#/shared/transport/gateway';

export interface ScopeClientsTab {
  list: ScopeClients;
  count: string;
  // What the caller lacks to search for a client to assign.
  needs: readonly AdminCapability[];
  // Whether it may: whoami has answered and names nothing missing.
  offered: boolean;
  picker: PickerState<Client>;
  chosen: Client | null;
  choose: (ids: readonly string[]) => void;
  assignment: string;
  setAssignment: (value: string) => void;
  // The client whose change is in flight.
  working: string | null;
  // What the last change said when it did not go through.
  message: string | null;
  assign: () => Promise<boolean>;
  change: (row: ScopeClient, assignment: string) => Promise<boolean>;
  remove: (row: ScopeClient) => Promise<boolean>;
}

export function useScopeClientsTab({
  tenant,
  scope,
}: {
  tenant: string;
  scope: ClientScope;
}): ScopeClientsTab {
  const refusal = useRefusal(tenant);
  const push = useToasts((queue) => queue.push);
  const list = useScopeClients(tenant, scope.id);
  const changes = useClientAssignment(tenant, scope.id);
  const authority = useAuthority(tenant);
  const needs = lacking(authority, ['manage-clients']);
  const offered = clientsOffered(authority !== undefined, needs);
  const picker = useClientPicker(tenant, offered);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [assignment, setAssignment] = useState('default');
  const [working, setWorking] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const failed = (
    failure: GatewayFailure,
    client: string,
    verb: 'assigned' | 'unassigned',
  ): void => {
    refusal.report(failure, 'manage-tenant');
    setMessage(clientAssignmentFailure(failure, scope.name, client, verb));
  };

  // One change at a time: what it said is shown, and whether it went is answered.
  const perform = (
    client: { id: string; name: string },
    verb: 'assigned' | 'unassigned',
    run: () => Promise<GatewayResult<unknown>>,
    done: string,
  ): Promise<boolean> => {
    if (working !== null) return Promise.resolve(false);
    setWorking(client.id);
    setMessage(null);
    return run()
      .then((result): boolean => {
        if (!result.ok) {
          failed(result, client.name, verb);
          return false;
        }
        push({ tone: 'success', message: done });
        return true;
      })
      .catch((): boolean => {
        failed({ ok: false, kind: 'defect' }, client.name, verb);
        return false;
      })
      .finally(() => {
        setWorking(null);
      });
  };

  const assignTo = (client: { id: string; name: string }, chosenAssignment: string) =>
    perform(
      client,
      'assigned',
      () => changes.assign.run({ clientId: client.id, assignment: assignmentOf(chosenAssignment) }),
      assignedText(scope.name, client.name, assignmentOf(chosenAssignment)),
    );

  const chosen = chosenClient(picker.options, chosenId);
  return {
    list,
    count: clientsCount(list.rows.length, list.more),
    needs,
    offered,
    picker,
    chosen,
    choose: (ids) => {
      setChosenId(lastChosen(ids));
    },
    assignment,
    setAssignment,
    working,
    message,
    assign: async () => {
      if (chosen === null) return false;
      const went = await assignTo(chosen, assignment);
      if (went) setChosenId(null);
      return went;
    },
    change: (row, next) => assignTo({ id: row.id, name: row.name }, next),
    remove: (row) =>
      perform(
        { id: row.id, name: row.name },
        'unassigned',
        () => changes.unassign.run({ clientId: row.id }),
        unassignedText(scope.name, row.name),
      ),
  };
}
