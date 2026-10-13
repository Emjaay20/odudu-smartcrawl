import type { ClientScope } from '@odudu/contracts/admin';
import { useRefusal } from '#/features/session';
import { useScopeClients } from '#/features/scopes/repository/useScopeClients';
import {
  useScopeDeletion,
  useScopeMappersRecord,
  useScopeSaves,
  type AssignmentValues,
  type ConsentValues,
  type TokenValues,
} from '#/features/scopes/repository/useScopeRecord';
import {
  ACCESS_TOKEN_LABEL,
  assignmentName,
  carryingOf,
  claimMappersOf,
  CONSENT_RULE,
  consentGuard,
  GUARDED_TEXT,
  ID_TOKEN_LABEL,
  isGuarded,
  NEW_CLIENT_CHOICES,
  NEW_CLIENT_LABEL,
  scopeDeleteConsequence,
  scopeDeleteDialogText,
  scopeDeleteFailureText,
  scopeRecord,
  scopesHref,
} from '#/features/scopes/service';
import { useGo } from '#/shared/repository/useGo';
import { useSectionSave, type SectionSave } from '#/shared/repository/useSectionSave';
import { useToast } from '#/shared/repository/useToasts';
import { useConfirmedRemoval, type Removal } from '#/shared/usecase/useConfirmedChange';
import { writeRefusal } from '#/shared/service/capabilities';
import { deletedText } from '#/shared/service/failure';
import { DESCRIPTION_RULE } from '#/shared/service/labels';
import type { DescriptionValues } from '#/shared/service/sectionValues';
import type { Choice } from '#/shared/service/choice';
import type { AdminCapability } from '#/shared/service/principal';

const MANAGE: AdminCapability = 'manage-tenant';

export interface Deletion extends Removal {
  // Why it is never offered, said in place of the button.
  fixed: string | null;
  consequence: string;
  // What the dialog says: how many clients lose the scope, then the consequence.
  warning: string;
}

export interface ScopeGeneral {
  description: SectionSave<DescriptionValues>;
  descriptionRule: string;
  tokens: SectionSave<TokenValues>;
  assignment: SectionSave<AssignmentValues>;
  assignmentChoices: readonly Choice[];
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
  const toast = useToast();
  const go = useGo();
  const removal = useConfirmedRemoval({
    refusal,
    capability: MANAGE,
    change: deletion,
    failureText: (failure) => scopeDeleteFailureText(scope.name, failure),
    done: () => {
      toast.succeeded(deletedText(scope.name));
      go(scopesHref(tenant), { replace: true });
    },
  });
  const carriers = useScopeClients(tenant, scope.id, removal.confirming);
  const mappers = useScopeMappersRecord(tenant, scope.id, removal.confirming);
  const common = {
    tenant,
    record: scopeRecord(scope.id),
    etag,
    capability: MANAGE,
    gone,
    refusal,
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
      },
      include_in_access_token: {
        value: scope.include_in_access_token,
        label: ACCESS_TOKEN_LABEL,
        kind: 'plain',
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
      ...removal,
      fixed: isGuarded(scope.name) ? GUARDED_TEXT : null,
      consequence: scopeDeleteConsequence(scope.name),
      warning: scopeDeleteDialogText(
        scope.name,
        carryingOf(carriers.status, carriers.rows.length, carriers.more),
        claimMappersOf(mappers.data),
      ),
    },
  };
}
