import type { ClientScope } from '@odudu/contracts/admin';
import { useState } from 'react';
import { useAuthority, useRefusal } from '#/features/session';
import { useCopySource, useCreateScope } from '#/features/scopes/repository/useCreateScope';
import {
  sourceDescription,
  createBodyOf,
  type Copying,
  copyingOf,
  copyPlan,
  partialCopy,
  scopeHref,
  scopesHref,
} from '#/features/scopes/service';
import { useGo } from '#/shared/repository/useGo';
import { useToasts } from '#/shared/repository/useToasts';
import { useUrlSearch } from '#/shared/repository/useUrlSearch';
import { problemAt, requiredProblem } from '#/shared/service/fieldErrors';
import { createdText, lookupText, namedCreation } from '#/shared/service/failure';
import { DESCRIPTION_RULE } from '#/shared/service/labels';
import { useCreationFlow } from '#/shared/usecase/useCreationFlow';
import { copiedDescription, type PartialCopy } from '#/shared/service/copy';

type Field = 'name' | 'description';
type Errors = Partial<Record<Field, string>>;

export type { Copying, PartialCopy };

export interface NewScope {
  listHref: string;
  descriptionRule: string;
  copying: Copying;
  name: string;
  description: string;
  errors: Errors;
  message: string | null;
  // The POST's answer was lost: offer to look for the scope rather than send it again.
  unconfirmed: boolean;
  // A copy made, without some of what it maps or binds.
  partial: PartialCopy | null;
  busy: boolean;
  editName: (name: string) => void;
  editDescription: (description: string) => void;
  submit: () => void;
  check: () => void;
}

export function useNewScope(tenant: string): NewScope {
  const refusal = useRefusal(tenant);
  const creation = useCreateScope(tenant);
  const go = useGo();
  const push = useToasts((queue) => queue.push);
  const { params } = useUrlSearch();
  const source = useCopySource(tenant, params.get('copy'));
  const caller = useAuthority(tenant)?.capabilities;
  const [name, setName] = useState('');
  const [description, setDescription] = useState<string | null>(null);
  const flow = useCreationFlow<Field>(refusal);
  const [partial, setPartial] = useState<PartialCopy | null>(null);
  const shown = copiedDescription(description, sourceDescription(source));
  const plan = copyPlan(source.status === 'ready' ? source.roles : [], caller, tenant);
  const mappers = source.status === 'ready' ? source.bound : [];
  const looked = lookupText('scope', name);

  const land = (scope: ClientScope, missed: Parameters<typeof partialCopy>[2]): void => {
    const left = partialCopy(tenant, scope, missed);
    if (left !== null) {
      setPartial(left);
      return;
    }
    push({ tone: 'success', message: createdText(scope.name) });
    go(scopeHref(tenant, scope.id), { replace: true });
  };

  const made = (scope: ClientScope): void => {
    creation
      .fill(
        scope.id,
        plan.mapped.map((role) => role.id),
        mappers,
      )
      .then((missed) => {
        land(scope, missed);
      })
      .catch(() => {
        land(scope, ['roles', 'mappers']);
      });
  };

  return {
    listHref: scopesHref(tenant),
    descriptionRule: DESCRIPTION_RULE,
    copying: copyingOf(source, plan),
    name,
    description: shown,
    errors: flow.errors,
    message: flow.message,
    unconfirmed: flow.unconfirmed,
    partial,
    busy: creation.busy || source.status === 'loading' || caller === undefined,
    editName: (next) => {
      setName(next);
      flow.edited('name');
    },
    editDescription: (next) => {
      setDescription(next);
      flow.edited('description');
    },
    submit: () => {
      flow.submit({
        blocked:
          creation.busy || partial !== null || source.status === 'loading' || caller === undefined,
        problem: problemAt('name', requiredProblem(name, 'Enter a name.')),
        spec: namedCreation('scope', name),
        create: () => creation.create(createBodyOf(name, shown, source)),
        made,
      });
    },
    check: () => {
      flow.check({ busy: creation.busy, find: () => creation.find(name), made, looked });
    },
  };
}
