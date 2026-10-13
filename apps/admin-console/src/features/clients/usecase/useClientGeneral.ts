import {
  useClientSection,
  type ClientRecordRead,
} from '#/features/clients/usecase/useClientSection';
import { useGo } from '#/shared/repository/useGo';
import {
  useClientDeletion,
  useClientSaves,
  type ConsentValues,
  type DetailValues,
  type EnabledValues,
  type PageValues,
} from '#/features/clients/repository/useClientRecord';
import {
  clientRefusal,
  clientsHref,
  deleteConsequence,
  deleteFixed,
  enabledFixed,
  FIELD,
  SECTION,
} from '#/features/clients/service';
import { useSectionSave, type SectionSave } from '#/shared/repository/useSectionSave';
import { useToast } from '#/shared/repository/useToasts';
import { useConfirmedRemoval, type Removal } from '#/shared/usecase/useConfirmedChange';
import { deletedText, writeFailureText } from '#/shared/service/failure';
import { DESCRIPTION_MAX, DESCRIPTION_RULE } from '#/shared/service/labels';

export type { SectionSave };

export interface Deletion extends Removal {
  consequence: string;
}

export interface ClientGeneral {
  details: SectionSave<DetailValues>;
  descriptionRule: string;
  descriptionLimit: number;
  pages: SectionSave<PageValues>;
  availability: SectionSave<EnabledValues>;
  // Why it cannot be disabled, said in place of the toggle.
  enabledFixed: string | null;
  consent: SectionSave<ConsentValues>;
  // Why it cannot be deleted, said in place of the button.
  deleteFixed: string | null;
  deletion: Deletion;
}

export function useClientGeneral({ tenant, client, etag, gone }: ClientRecordRead): ClientGeneral {
  const saves = useClientSaves(tenant, client.id);
  const toast = useToast();
  const go = useGo();
  const shared = useClientSection({ tenant, client, etag, gone });
  const copy = {
    name: client.name,
    verb: 'deleted',
    lookAt: 'the clients',
    refused: clientRefusal,
  };
  const deletion = useClientDeletion(tenant, client.id);
  const removal = useConfirmedRemoval({
    refusal: shared.refusal,
    capability: shared.capability,
    change: deletion,
    failureText: (failure) => writeFailureText(failure, copy),
    onRefused: shared.onRefused,
    done: () => {
      toast.succeeded(deletedText(client.name));
      go(clientsHref(tenant), { replace: true });
    },
  });

  const details = useSectionSave({
    ...shared,
    section: 'details',
    label: SECTION.details,
    fields: {
      name: { value: client.name, label: FIELD.name, kind: 'plain' },
      description: { value: client.description ?? '', label: FIELD.description, kind: 'plain' },
    },
    save: saves.details,
  });
  const pages = useSectionSave({
    ...shared,
    section: 'pages',
    label: SECTION.pages,
    fields: {
      client_uri: { value: client.client_uri ?? '', label: FIELD.homePage, kind: 'plain' },
      policy_uri: { value: client.policy_uri ?? '', label: FIELD.privacyPolicy, kind: 'plain' },
      tos_uri: { value: client.tos_uri ?? '', label: FIELD.termsOfService, kind: 'plain' },
    },
    save: saves.pages,
  });
  const availability = useSectionSave({
    ...shared,
    section: 'availability',
    label: SECTION.availability,
    fields: {
      enabled: {
        value: client.enabled,
        label: FIELD.enabled,
        kind: 'plain',
      },
    },
    save: saves.availability,
  });
  const consent = useSectionSave({
    ...shared,
    section: 'consent',
    label: SECTION.consent,
    fields: {
      consent_required: {
        value: client.consent_required,
        label: FIELD.consentRequired,
        kind: 'plain',
      },
    },
    save: saves.consent,
  });

  return {
    details,
    descriptionRule: DESCRIPTION_RULE,
    descriptionLimit: DESCRIPTION_MAX,
    pages,
    availability,
    enabledFixed: enabledFixed(client),
    consent,
    deleteFixed: deleteFixed(client),
    deletion: { ...removal, consequence: deleteConsequence(client.name) },
  };
}
