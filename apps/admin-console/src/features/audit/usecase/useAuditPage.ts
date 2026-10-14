import type { AuditEvent } from '@odudu/contracts/admin';
import { useState } from 'react';
import { useAuthority } from '#/features/session';
import { clientHref } from '#/features/clients';
import { groupHref } from '#/features/groups';
import { roleHref } from '#/features/roles';
import { scopeHref } from '#/features/scopes';
import { subjectHref } from '#/features/subjects';
import { useAuditList, type AuditList } from '#/features/audit/repository/useAuditList';
import {
  actorHref,
  auditQuery,
  draftOf,
  draftProblems,
  EMPTY_DRAFT,
  filtersOf,
  isClean,
  isFiltered,
  loadedRange,
  resourceHref,
  shownProblems,
  withField,
  type Draft,
  type DraftProblems,
  type FilterName,
  type RecordPages,
} from '#/features/audit/service';
import { holds } from '#/shared/service/access';
import { localZone } from '#/shared/service/zones';
import type { AuditHrefs } from '#/shared/view/AuditTable';

const RECORD_PAGES: RecordPages = {
  subject: subjectHref,
  client: clientHref,
  group: groupHref,
  role: roleHref,
  scope: scopeHref,
};

export interface AuditFilterForm {
  draft: Draft;
  // Shown once the form has been submitted with them in it.
  problems: DraftProblems;
  set: (name: FilterName, value: string) => void;
  submit: () => void;
  clear: () => void;
  // Whether there is anything to clear: a filter held, or typed.
  filtered: boolean;
}

export interface AuditPageState {
  list: AuditList;
  form: AuditFilterForm;
  hrefs: AuditHrefs;
  // Whether the address holds any filter the trail can read.
  narrowed: boolean;
  // How far back the rows loaded reach, since the trail has no count.
  range: string | null;
}

function useFilterForm(list: AuditList): AuditFilterForm {
  const held = auditQuery(list.filters).toString();
  const [synced, setSynced] = useState(held);
  const [draft, setDraft] = useState(() => draftOf(list.filters));
  const [attempted, setAttempted] = useState(false);
  // Back, forward and a shared link change the address under the form.
  if (synced !== held) {
    setSynced(held);
    setDraft(draftOf(list.filters));
    setAttempted(false);
  }
  const problems = draftProblems(draft);
  return {
    draft,
    problems: shownProblems(problems, attempted),
    set: (name, value) => {
      setDraft((was) => withField(was, name, value));
    },
    submit: () => {
      setAttempted(true);
      if (isClean(problems)) list.apply(filtersOf(draft));
    },
    clear: () => {
      setDraft(EMPTY_DRAFT);
      setAttempted(false);
      list.apply({});
    },
    filtered: isFiltered(list.filters) || isFiltered(filtersOf(draft)),
  };
}

export function useAuditPage(tenant: string): AuditPageState {
  const list = useAuditList(tenant);
  const form = useFilterForm(list);
  const mayReadSubjects = holds(useAuthority(tenant), 'view-users');
  return {
    list,
    form,
    hrefs: {
      resource: (event: AuditEvent) =>
        resourceHref(tenant, event.resource_type, event.resource_id, RECORD_PAGES),
      actor: (event: AuditEvent) => actorHref(tenant, event, mayReadSubjects, subjectHref),
    },
    narrowed: isFiltered(list.filters),
    range: loadedRange(list.rows, localZone()),
  };
}
