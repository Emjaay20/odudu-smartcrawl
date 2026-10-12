import type { Subject } from '@odudu/contracts/admin';
import { readAdministratorPage } from '#/shared/adapter/administrators';
import { usePicker } from '#/shared/repository/usePicker';
import type { PickerState } from '#/shared/service/picker';
import { SYSTEM_TENANT } from '#/shared/service/principal';

export function useSubjectPicker(): PickerState<Subject> {
  return usePicker({
    tenant: SYSTEM_TENANT,
    resource: 'subjects',
    field: 'username',
    read: (gateway, query) => readAdministratorPage(gateway, SYSTEM_TENANT, query),
  });
}
