import type { ClientScope } from '@odudu/contracts/admin';
import { useState } from 'react';
import { useRefusal } from '#/features/session';
import {
  useScopeDeletion,
  useScopeSaves,
  type AssignmentValues,
  type ConsentValues,
  type DescriptionValues,
  type TokenValues,
} from '#/features/scopes/repository/useScopeRecord';
import {
  ACCESS_TOKEN_LABEL,
  assignmentName,
  CONSENT_RULE,
  DESCRIPTION_RULE,
  consentGuard,
  GUARDED_TEXT,
  ID_TOKEN_LABEL,
  isGuarded,
  NEW_CLIENT_CHOICES,
  NEW_CLIENT_LABEL,
  scopeDeleteConsequence,
  scopeDeleteFailureText,
  scopeRecord,
  scopesHref,
} from '#/features/scopes/service';
import { useGo } from '#/shared/repository/useGo';
import { useSectionSave, type SectionSave } from '#/shared/repository/useSectionSave';
import { useToasts } from '#/shared/repository/useToasts';
import { writeRefusal } from '#/shared/service/capabilities';
import { deletedText } from '#/shared/service/failure';
import { flagText } from '#/shared/service/format';
import type { GatewayFailure } from '#/shared/transport/gateway';

export interface Deletion {
  // Why it is never offered, said in place of the button.
  fixed: string | null;
  confirming: boolean;
  consequence: string;
  busy: boolean;
  problem: string | null;
  ask: () => void;
  cancel: () => void;
  confirm: () => void;
}

export interface ScopeGeneral {
  description: SectionSave<DescriptionValues>;
  descriptionRule: string;
  tokens: SectionSave<TokenValues>;
  assignment: SectionSave<AssignmentValues>;
  assignmentChoices: readonly { id: string; label: string }[];
  consent: SectionSave<ConsentValues>;
  consentRule: string;
  deletion: Deletion;
}

export function useScopeGeneral({
  tenant,
  scope,
  etag,
  gone,
}: {
  tenant: string;
  scope: ClientScope;
  etag: string;
  gone: boolean;
}): ScopeGeneral {
  const refusal = useRefusal(tenant);
  const saves = useScopeSaves(tenant, scope.id);
  const deletion = useScopeDeletion(tenant, scope.id);
  const push = useToasts((queue) => queue.push);
  const go = useGo();
  const [deleting, setDeleting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const common = {
    tenant,
    record: scopeRecord(scope.id),
    etag,
    capability: 'manage-tenant',
    gone,
    onRefused: (failure: GatewayFailure) => {
      refusal.report(failure, 'manage-tenant');
    },
    explain: writeRefusal,
  };
  const description = useSectionSave({
    ...common,
    section: 'description',
    label: 'Description',
    fields: {
      description: { value: scope.description ?? '', label: 'Description', kind: 'plain' },
    },
    save: saves.general,
  });
  const tokens = useSectionSave({
    ...common,
    section: 'tokens',
    label: 'Tokens',
    fields: {
      include_in_id_token: {
        value: scope.include_in_id_token,
        label: ID_TOKEN_LABEL,
        kind: 'plain',
        describe: (value) => flagText(value, 'on', 'off'),
      },
      include_in_access_token: {
        value: scope.include_in_access_token,
        label: ACCESS_TOKEN_LABEL,
        kind: 'plain',
        describe: (value) => flagText(value, 'on', 'off'),
      },
    },
    save: saves.general,
  });
  const assignment = useSectionSave({
    ...common,
    section: 'new-clients',
    label: 'New clients',
    fields: {
      default_client_assignment: {
        value: scope.default_client_assignment ?? 'none',
        label: NEW_CLIENT_LABEL,
        kind: 'plain',
        describe: assignmentName,
      },
    },
    save: saves.general,
  });
  const consent = useSectionSave({
    ...common,
    section: 'consent',
    label: 'Consent',
    fields: {
      consent_text: { value: scope.consent_text ?? '', label: 'Consent text', kind: 'plain' },
      display_order: {
        value: String(scope.display_order),
        label: 'Display order',
        kind: 'plain',
      },
    },
    save: saves.general,
  });
  const guarded = consentGuard(
    consent.values.display_order,
    consent.changed,
    consent.fieldErrors,
    consent.blocked,
  );

  return {
    description,
    descriptionRule: DESCRIPTION_RULE,
    tokens,
    assignment,
    assignmentChoices: NEW_CLIENT_CHOICES,
    consent: { ...consent, ...guarded },
    consentRule: CONSENT_RULE,
    deletion: {
      fixed: isGuarded(scope.name) ? GUARDED_TEXT : null,
      confirming: deleting,
      consequence: scopeDeleteConsequence(scope.name),
      busy: deletion.busy,
      problem,
      ask: () => {
        setProblem(null);
        setDeleting(true);
      },
      cancel: () => {
        setProblem(null);
        setDeleting(false);
      },
      confirm: () => {
        if (deletion.busy) return;
        setProblem(null);
        deletion
          .run()
          .then((result) => {
            if (result.ok) {
              setDeleting(false);
              push({ tone: 'success', message: deletedText(scope.name) });
              go(scopesHref(tenant), { replace: true });
              return;
            }
            refusal.report(result, 'manage-tenant');
            setProblem(scopeDeleteFailureText(scope.name, result));
          })
          .catch(() => {
            setProblem(scopeDeleteFailureText(scope.name, { ok: false, kind: 'defect' }));
          });
      },
    },
  };
}
