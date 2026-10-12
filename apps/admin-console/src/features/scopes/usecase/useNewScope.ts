import type { ClientScope } from '@odudu/contracts/admin';
import { useState } from 'react';
import { useAuthority, useRefusal } from '#/features/session';
import { useCopySource, useCreateScope } from '#/features/scopes/repository/useCreateScope';
import {
  copiedDescription,
  createBodyOf,
  type Copying,
  copyingOf,
  copyPlan,
  DESCRIPTION_RULE,
  NAME_TAKEN,
  type PartialCopy,
  partialCopy,
  scopeHref,
  scopesHref,
} from '#/features/scopes/service';
import { useGo } from '#/shared/repository/useGo';
import { useToasts } from '#/shared/repository/useToasts';
import { useUrlSearch } from '#/shared/repository/useUrlSearch';
import { requiredProblem, withoutField } from '#/shared/service/fieldErrors';
import { createdText, createFailure, lookupText } from '#/shared/service/failure';
import type { GatewayFailure } from '#/shared/transport/gateway';

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
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [partial, setPartial] = useState<PartialCopy | null>(null);
  const shown = copiedDescription(description, source);
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

  const failed = (failure: GatewayFailure): void => {
    const outcome = createFailure(failure, {
      noun: 'scope',
      name,
      fields: ['name', 'description'],
      taken: { field: 'name', fallback: NAME_TAKEN },
      capability: 'manage-tenant',
    });
    if (outcome.unconfirmed) setUnconfirmed(true);
    if (outcome.report) refusal.report(failure, 'manage-tenant');
    setErrors(outcome.errors);
    setMessage(outcome.message);
  };

  return {
    listHref: scopesHref(tenant),
    descriptionRule: DESCRIPTION_RULE,
    copying: copyingOf(source, plan),
    name,
    description: shown,
    errors,
    message,
    unconfirmed,
    partial,
    busy: creation.busy || source.status === 'loading' || caller === undefined,
    editName: (next) => {
      setName(next);
      setErrors((was) => withoutField(was, 'name'));
    },
    editDescription: (next) => {
      setDescription(next);
      setErrors((was) => withoutField(was, 'description'));
    },
    submit: () => {
      if (
        creation.busy ||
        unconfirmed ||
        partial !== null ||
        source.status === 'loading' ||
        caller === undefined
      ) {
        return;
      }
      const required = requiredProblem(name, 'Enter a name.');
      if (required !== null) {
        setErrors({ name: required });
        return;
      }
      setErrors({});
      setMessage(null);
      creation
        .create(createBodyOf(name, shown, source))
        .then((result) => {
          if (result.ok) made(result.data);
          else failed(result);
        })
        .catch(() => {
          failed({ ok: false, kind: 'defect' });
        });
    },
    check: () => {
      if (creation.busy) return;
      creation
        .find(name)
        .then((result) => {
          if (!result.ok) {
            setMessage(looked.failed);
            return;
          }
          if (result.data !== null) {
            made(result.data);
            return;
          }
          setUnconfirmed(false);
          setMessage(looked.missing);
        })
        .catch(() => {
          setMessage(looked.failed);
        });
    },
  };
}
