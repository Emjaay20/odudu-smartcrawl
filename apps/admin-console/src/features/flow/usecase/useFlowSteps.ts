import type { ExecutionRequirement, ListExecutionsResponse } from '@odudu/contracts/admin';
import { useState } from 'react';
import { useRefusal } from '#/features/session';
import { flowSaves, FLOW_RECORD, type StepValues } from '#/features/flow/repository/useFlowRecord';
import {
  addable,
  added,
  canMove,
  chosenAddition,
  describeSteps,
  FLOW_TITLE,
  flowFailure,
  moved,
  stepsOf,
  withRequirement,
  type Direction,
  type Step,
} from '#/features/flow/service';
import { useSectionSave, type SectionSave } from '#/shared/repository/useSectionSave';
import { writeRefusal } from '#/shared/service/capabilities';

export interface FlowSteps {
  save: SectionSave<StepValues>;
  steps: readonly Step[];
  canMove: (authenticator: string, direction: Direction) => boolean;
  move: (authenticator: string, direction: Direction) => void;
  setRequirement: (authenticator: string, requirement: ExecutionRequirement) => void;
  // What the registry offers that is not yet a step.
  offered: readonly string[];
  adding: string;
  addingRequirement: ExecutionRequirement;
  chooseAddition: (authenticator: string) => void;
  chooseAdditionRequirement: (requirement: ExecutionRequirement) => void;
  add: () => void;
}

export function useFlowSteps({
  tenant,
  data,
  etag,
  gone,
}: {
  tenant: string;
  data: ListExecutionsResponse;
  etag: string;
  gone: boolean;
}): FlowSteps {
  const refusal = useRefusal(tenant);
  const saves = flowSaves(tenant);
  const [picked, setPicked] = useState('');
  const [addingRequirement, setAddingRequirement] = useState<ExecutionRequirement>('conditional');
  const save = useSectionSave({
    tenant,
    record: FLOW_RECORD,
    section: 'steps',
    label: FLOW_TITLE,
    etag,
    capability: 'manage-tenant',
    gone,
    onRefused: (failure) => {
      refusal.report(failure, 'manage-tenant');
    },
    explain: writeRefusal,
    fields: {
      steps: {
        value: stepsOf(data.items),
        label: 'Steps',
        kind: 'plain',
        describe: describeSteps,
      },
    },
    save: async (gateway, input) => {
      const result = await saves.steps(gateway, input);
      return result.ok ? result : flowFailure(result);
    },
  });
  const steps = save.values.steps;
  const offered = addable(data.available, steps);
  const adding = chosenAddition(offered, picked);
  return {
    save,
    steps,
    canMove: (authenticator, direction) => canMove(steps, authenticator, direction),
    move: (authenticator, direction) => {
      save.edit('steps', moved(steps, authenticator, direction));
    },
    setRequirement: (authenticator, requirement) => {
      save.edit('steps', withRequirement(steps, authenticator, requirement));
    },
    offered,
    adding,
    addingRequirement,
    chooseAddition: setPicked,
    chooseAdditionRequirement: setAddingRequirement,
    add: () => {
      save.edit('steps', added(steps, adding, addingRequirement));
    },
  };
}
