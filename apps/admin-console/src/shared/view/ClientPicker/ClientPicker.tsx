import type { Client } from '@odudu/contracts/admin';
import type { PickerState } from '#/shared/service/picker.ts';
import { Picker } from '#/shared/view/Picker';

type ClientOption = Pick<Client, 'id' | 'name' | 'client_id' | 'type'>;

// The client id is what a person knows an application by, and two clients
// can share a name, so each option carries both.
export function ClientPicker({
  label,
  picker,
  selected,
  onChange,
  selectionMode = 'multiple',
  unavailableOf,
}: {
  label: string;
  picker: PickerState<ClientOption>;
  selected: readonly string[];
  onChange: (ids: string[]) => void;
  selectionMode?: 'single' | 'multiple';
  // Why a client cannot be chosen here, or null when it can.
  unavailableOf?: (client: ClientOption) => string | null;
}) {
  return (
    <Picker
      label={label}
      noun={{ one: 'client', other: 'clients' }}
      picker={picker}
      idOf={(client) => client.id}
      nameOf={(client) => client.name}
      detailOf={(client) => `${client.client_id} · ${client.type}`}
      capability="manage-clients"
      selected={selected}
      onChange={onChange}
      selectionMode={selectionMode}
      {...(unavailableOf === undefined ? {} : { unavailableOf })}
    />
  );
}
