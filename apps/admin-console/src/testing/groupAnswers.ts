export interface GroupAnswer {
  id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  default_for_new_subjects: boolean;
  path: string;
  created_at: string;
  admin_reach: readonly string[];
}

export function group(
  id: string,
  path: string,
  parent: string | null = null,
  extra: Partial<GroupAnswer> = {},
): GroupAnswer {
  return {
    id,
    name: path.split('/').at(-1) ?? path,
    description: null,
    parent_id: parent,
    default_for_new_subjects: false,
    path,
    created_at: '2026-09-28T08:41:53.858Z',
    admin_reach: [],
    ...extra,
  };
}

// A group as its own record answers it, with what deleting it would take and
// whether it or a group beneath it is a default for new subjects.
export function record(
  each: GroupAnswer,
  subtree: readonly string[] = [],
  holdsDefault: boolean = each.default_for_new_subjects,
) {
  return { ...each, subtree_admin_reach: subtree, holds_default_group: holdsDefault };
}
