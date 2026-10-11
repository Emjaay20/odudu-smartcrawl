import type { Client } from '@odudu/contracts/admin';
import { readClientPage } from '#/shared/adapter/directory.ts';
import { usePicker } from '#/shared/repository/usePicker.ts';
import type { PickerState } from '#/shared/service/picker.ts';

// A tenant can hold thousands of clients, so a search is a prefix of the name
// answered by the server a page at a time.
export function useClientPicker(tenant: string, enabled = true): PickerState<Client> {
  return usePicker({
    tenant,
    resource: 'clients',
    enabled,
    read: (gateway, query) => readClientPage(gateway, tenant, query),
  });
}
