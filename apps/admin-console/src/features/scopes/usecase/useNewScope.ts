import type { ClientScope } from '@odudu/contracts/admin';
import { useState } from 'react';
import { useRefusal } from '#/features/session';
import { useCreateScope } from '#/features/scopes/repository/useCreateScope.ts';
import { DESCRIPTION_RULE, NAME_TAKEN, scopeHref, scopesHref } from '#/features/scopes/service';
import { useGo } from '#/shared/repository/useGo.ts';
import { useToasts } from '#/shared/repository/useToasts.ts';
import { requiredProblem, withoutField } from '#/shared/service/fieldErrors.ts';
import { createdText, createFailure, lookupText } from '#/shared/service/failure.ts';
import type { GatewayFailure } from '#/shared/transport/gateway.ts';

type Field = 'name' | 'description';
type Errors = Partial<Record<Field, string>>;

export interface NewScope {
  listHref: string;
  descriptionRule: string;
  name: string;
  description: string;
  errors: Errors;
  message: string | null;
  // The POST's answer was lost: offer to look for the scope rather than send it again.
  unconfirmed: boolean;
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
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const looked = lookupText('scope', name);

  const land = (scope: ClientScope): void => {
    push({ tone: 'success', message: createdText(scope.name) });
    go(scopeHref(tenant, scope.id), { replace: true });
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
    name,
    description,
    errors,
    message,
    unconfirmed,
    busy: creation.busy,
    editName: (next) => {
      setName(next);
      setErrors((was) => withoutField(was, 'name'));
    },
    editDescription: (next) => {
      setDescription(next);
      setErrors((was) => withoutField(was, 'description'));
    },
    submit: () => {
      if (creation.busy || unconfirmed) return;
      const required = requiredProblem(name, 'Enter a name.');
      if (required !== null) {
        setErrors({ name: required });
        return;
      }
      setErrors({});
      setMessage(null);
      creation
        .create({ name, description })
        .then((result) => {
          if (result.ok) land(result.data);
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
            land(result.data);
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
