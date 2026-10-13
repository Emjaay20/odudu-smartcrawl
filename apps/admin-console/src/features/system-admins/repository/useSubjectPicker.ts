import type { Subject } from '@odudu/contracts/admin';
import { readSubjectPage } from '#/shared/adapter/directory';
import { usePicker } from '#/shared/repository/usePicker';
import type { PickerState } from '#/shared/service/picker';
import { SYSTEM_TENANT } from '#/shared/service/principal';

export function useSubjectPicker(): PickerState<Subject> {
  return usePicker({
    tenant: SYSTEM_TENANT,
    resource: 'subjects',
    field: 'username',
    read: (gateway, query) => readSubjectPage(gateway, SYSTEM_TENANT, query),
  });
}
