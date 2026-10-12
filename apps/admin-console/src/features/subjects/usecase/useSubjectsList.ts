import type { Subject } from '@odudu/contracts/admin';
import { useAuthority } from '#/features/session';
import { useGo } from '#/shared/repository/useGo';
import { useSubjectList } from '#/features/subjects/repository/useSubjectList';
import { createSubjectHref, subjectHref } from '#/features/subjects/service';
import { lacking } from '#/shared/service/access';
import type { AdminCapability } from '#/shared/service/principal';
import type { ResourceListState } from '#/shared/service/resourceList';

export interface SubjectsList {
  list: ResourceListState<Subject>;
  // Null while whoami says creating would be refused.
  createHref: string | null;
  // What changing a subject needs that whoami says is missing.
  changeNeeds: readonly AdminCapability[];
  open: (id: string) => void;
}

export function useSubjectsList(tenant: string): SubjectsList {
  const list = useSubjectList(tenant);
  const authority = useAuthority(tenant);
  const go = useGo();
  const changeNeeds = lacking(authority, ['manage-users']);
  return {
    list,
    createHref: createSubjectHref(tenant, changeNeeds),
    changeNeeds,
    open: (id) => {
      go(subjectHref(tenant, id));
    },
  };
}
